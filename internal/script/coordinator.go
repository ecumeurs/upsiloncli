package script

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/dop251/goja"
	"github.com/ecumeurs/upsiloncli/internal/endpoint"
)

func RunFarm(baseURL string, reg *endpoint.Registry, scriptPaths []string, logDir string, timeoutSecs int, quiet bool, isLocal bool) bool {
	var wg sync.WaitGroup
	sharedStore := NewSharedStore()

	var agents []*Agent
	var agentsMu sync.Mutex
	
	var hasError bool
	var errorMu sync.Mutex

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Catch SIGINT/SIGTERM to allow graceful teardown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	
	triggerInterrupt := func(reason string) {
		cancel() // Signal context cancellation
		
		agentsMu.Lock()
		for _, a := range agents {
			// Interrupt the VM execution. This causes RunString and any blocking bridge 
			// calls (like sleep or waitForEvent) to return with an error.
			a.VM.Interrupt(fmt.Errorf("%s", reason))
		}
		agentsMu.Unlock()
	}

	go func() {
		sig := <-sigChan
		ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
		fmt.Printf("\n[{%s}] [Farm] Received %v. Interrupting agents for cleanup...\n", ts, sig)
		triggerInterrupt(fmt.Sprintf("interrupted by %v", sig))
	}()

	if timeoutSecs > 0 {
		time.AfterFunc(time.Duration(timeoutSecs)*time.Second, func() {
			ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
			fmt.Printf("\n[{%s}] [Farm] Global timeout reached (%ds). Triggering teardown...\n", ts, timeoutSecs)
			triggerInterrupt(fmt.Sprintf("global timeout (%ds) reached", timeoutSecs))
		})
	}

	for i, path := range scriptPaths {
		wg.Add(1)
		go func(agentIdx int, scriptPath string) {
			defer wg.Done()

			agentID := fmt.Sprintf("Bot-%02d", agentIdx+1)
			
			var logger *os.File
			if logDir != "" {
				// Ensure log directory exists (absolute path for reliability)
				absLogDir, _ := filepath.Abs(logDir)
				if err := os.MkdirAll(absLogDir, 0755); err != nil {
					ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
					fmt.Printf("[{%s}] [Farm] Error creating log directory %s: %v\n", ts, absLogDir, err)
					logger = os.Stdout
				} else {
					scriptBase := filepath.Base(scriptPath)
					scriptBase = strings.TrimSuffix(scriptBase, filepath.Ext(scriptBase))
					fileName := fmt.Sprintf("%s_%s.log", scriptBase, agentID)
					logPath := filepath.Join(absLogDir, fileName)
					f, err := os.Create(logPath)
					if err != nil {
						ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
						fmt.Printf("[{%s}] [Farm] Error creating log file at %s: %v\n", ts, logPath, err)
						logger = os.Stdout
					} else {
						logger = f
						defer f.Close()
						if !quiet {
							ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
							fmt.Printf("[{%s}] [%s] Logging to %s\n", ts, agentID, logPath)
						}
					}
				}
			} else {
				logger = os.Stdout
			}

			agent := NewAgent(agentID, agentIdx, len(scriptPaths), isLocal, baseURL, reg, logger, sharedStore, quiet)
			agent.Ctx = ctx // Inject context
			agent.Session.Set("agent_index", fmt.Sprintf("%d", agentIdx))
			agent.Session.Set("agent_count", fmt.Sprintf("%d", len(scriptPaths)))
			
			agentsMu.Lock()
			agents = append(agents, agent)
			agentsMu.Unlock()

			agent.Listener.Start()
			
			// GUARANTEED TEARDOWN BLOCK
			defer func() {
				// 1. Run Go-side automated teardown first
				if agent.GoTeardownHook != nil {
					agent.GoTeardownHook()
				}

				// 2. Run JS-side teardown hook
				if agent.TeardownHook != nil {
					// Execute the JS teardown function safely
					_, err := agent.TeardownHook(goja.Undefined())
					if err != nil {
						ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
						fmt.Fprintf(logger, "[{%s}] [%s] JS Teardown hook failed: %v\n", ts, agentID, err)
					}
				}
				// Ensure WebSocket is closed cleanly
				agent.Listener.Stop() 
			}()
			
			scriptData, err := os.ReadFile(scriptPath)
			if err != nil {
				ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
				fmt.Fprintf(logger, "[{%s}] [%s] Error reading script: %v\n", ts, agentID, err)
				return
			}

			_, err = agent.VM.RunString(string(scriptData))
			if err != nil {
				errorMu.Lock()
				hasError = true
				errorMu.Unlock()

				ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
				if jsErr, ok := err.(*goja.Exception); ok {
					val := jsErr.Value().Export()
					if obj, ok := val.(map[string]interface{}); ok {
						msg, _ := obj["message"].(string)
						errKey, _ := obj["error_key"].(string)
						reqID, _ := obj["request_id"].(string)

						if msg != "" {
							formatted := fmt.Sprintf("JS Exception: %s", msg)
							if errKey != "" {
								formatted += fmt.Sprintf(" (key: %s)", errKey)
							}
							if reqID != "" && reqID != "cli-internal" {
								formatted += fmt.Sprintf(" [Req: %s]", reqID)
							}
							fmt.Fprintf(logger, "[{%s}] [%s] %s\n", ts, agentID, formatted)
						} else {
							// Fallback to JSON stringification for unknown objects
							jsonBytes, _ := json.Marshal(obj)
							fmt.Fprintf(logger, "[{%s}] [%s] JS Exception: (Object) %s\n", ts, agentID, string(jsonBytes))
						}
					} else {
						fmt.Fprintf(logger, "[{%s}] [%s] JS Exception: %v\n", ts, agentID, jsErr.String())
					}
				} else {
					fmt.Fprintf(logger, "[{%s}] [%s] Execution failed: %v\n", ts, agentID, err)
				}
			}
			
			ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
			fmt.Fprintf(logger, "[{%s}] [%s] Script execution finished.\n", ts, agentID)
		}(i, path)
	}

	wg.Wait()
	ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
	fmt.Printf("[{%s}] All agents have finished execution and cleanup.\n", ts)
	
	return !hasError
}
