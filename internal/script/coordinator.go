package script

import (
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"
	"context"

	"github.com/dop251/goja"
	"github.com/ecumeurs/upsiloncli/internal/endpoint"
)

func RunFarm(baseURL string, reg *endpoint.Registry, scriptPaths []string, logDir string, timeoutSecs int, quiet bool) {
	var wg sync.WaitGroup
	sharedStore := NewSharedStore()

	var agents []*Agent
	var agentsMu sync.Mutex

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
		ts := time.Now().UTC().Format(time.RFC3339)
		fmt.Printf("\n[{%s}] [Farm] Received %v. Interrupting agents for cleanup...\n", ts, sig)
		triggerInterrupt(fmt.Sprintf("interrupted by %v", sig))
	}()

	if timeoutSecs > 0 {
		time.AfterFunc(time.Duration(timeoutSecs)*time.Second, func() {
			ts := time.Now().UTC().Format(time.RFC3339)
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
					ts := time.Now().UTC().Format(time.RFC3339)
					fmt.Printf("[{%s}] [Farm] Error creating log directory %s: %v\n", ts, absLogDir, err)
					logger = os.Stdout
				} else {
					fileName := fmt.Sprintf("%s.log", agentID)
					logPath := filepath.Join(absLogDir, fileName)
					f, err := os.Create(logPath)
					if err != nil {
						ts := time.Now().UTC().Format(time.RFC3339)
						fmt.Printf("[{%s}] [Farm] Error creating log file at %s: %v\n", ts, logPath, err)
						logger = os.Stdout
					} else {
						logger = f
						defer f.Close()
						if !quiet {
							ts := time.Now().UTC().Format(time.RFC3339)
							fmt.Printf("[{%s}] [%s] Logging to %s\n", ts, agentID, logPath)
						}
					}
				}
			} else {
				logger = os.Stdout
			}

			agent := NewAgent(agentID, agentIdx, len(scriptPaths), baseURL, reg, logger, sharedStore, quiet)
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
						ts := time.Now().UTC().Format(time.RFC3339)
						fmt.Fprintf(logger, "[{%s}] [%s] JS Teardown hook failed: %v\n", ts, agentID, err)
					}
				}
				// Ensure WebSocket is closed cleanly
				agent.Listener.Stop() 
			}()
			
			scriptData, err := os.ReadFile(scriptPath)
			if err != nil {
				ts := time.Now().UTC().Format(time.RFC3339)
				fmt.Fprintf(logger, "[{%s}] [%s] Error reading script: %v\n", ts, agentID, err)
				return
			}

			_, err = agent.VM.RunString(string(scriptData))
			if err != nil {
				ts := time.Now().UTC().Format(time.RFC3339)
				if jsErr, ok := err.(*goja.Exception); ok {
					fmt.Fprintf(logger, "[{%s}] [%s] JS Exception: %v\n", ts, agentID, jsErr.String())
				} else {
					fmt.Fprintf(logger, "[{%s}] [%s] Execution failed: %v\n", ts, agentID, err)
				}
			}
			
			ts := time.Now().UTC().Format(time.RFC3339)
			fmt.Fprintf(logger, "[{%s}] [%s] Script execution finished.\n", ts, agentID)
		}(i, path)
	}

	wg.Wait()
	ts := time.Now().UTC().Format(time.RFC3339)
	fmt.Printf("[{%s}] All agents have finished execution and cleanup.\n", ts)
}
