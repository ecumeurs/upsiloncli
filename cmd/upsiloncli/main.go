package main

import (
	"flag"
	"fmt"
	"os"
	"runtime/debug"

	"github.com/ecumeurs/upsiloncli/internal/cli"
	"github.com/ecumeurs/upsiloncli/internal/endpoint"
	"github.com/ecumeurs/upsiloncli/internal/script"
	"github.com/joho/godotenv"
	"time"
)

func getGitRevision() string {
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, setting := range info.Settings {
			if setting.Key == "vcs.revision" {
				return setting.Value
			}
		}
	}
	return "unknown"
}

func main() {
	// Load .env if it exists
	_ = godotenv.Load()

	rev := getGitRevision()
	ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
	fmt.Printf("[{%s}] [INFO] UpsilonCLI starting (rev: %s)\n", ts, rev)

	appKey := os.Getenv("REVERB_APP_KEY")
	if appKey == "" {
		ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
		fmt.Printf("[{%s}] \033[31m\033[1m[ERROR]\033[0m Mandatory environment variable REVERB_APP_KEY is missing.\n", ts)
		fmt.Println("Please set it in your system environment or a .env file.")
		os.Exit(1)
	}

	upsilonBaseURL := os.Getenv("UPSILON_BASE_URL")
	if upsilonBaseURL == "" {
		ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
		fmt.Printf("[{%s}] \033[31m\033[1m[ERROR]\033[0m Mandatory environment variable UPSILON_BASE_URL is missing.\n", ts)
		fmt.Println("Please set it in your system environment or a .env file.")
		os.Exit(1)
	}
	baseURL := flag.String("base-url", upsilonBaseURL, "Laravel API base URL")
	local := flag.Bool("local", false, "Force local configuration (127.0.0.1:8000)")
	auto := flag.Bool("auto", false, "Run full journey in autopilot mode")
	persist := flag.Bool("persist", false, "Load/save session to .upsilon_session.json")
	flag.BoolVar(persist, "P", false, "Load/save session to .upsilon_session.json (shorthand)")
	farm := flag.Bool("farm", false, "Execute multiple bot scripts in parallel")
	quiet := flag.Bool("quiet", false, "Condense successful API logs")
	flag.BoolVar(quiet, "q", false, "Condense successful API logs (shorthand)")
	timeout := flag.Int("timeout", 0, "Global execution timeout in seconds")
	logDir := flag.String("logs", "", "Directory to store individual agent log files")
	flag.StringVar(logDir, "L", "", "Directory to store individual agent log files (shorthand)")
	flag.Parse()

	if *local {
		*baseURL = "http://127.0.0.1:8000"
		os.Setenv("REVERB_HOST", "127.0.0.1")
		os.Setenv("REVERB_PORT", "8080")
		os.Setenv("REVERB_SCHEME", "http")
	}

	if *auto {
		ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
		fmt.Printf("[{%s}] Autopilot mode — not yet implemented.\n", ts)
		os.Exit(0)
	}

	if *farm {
		if flag.NArg() == 0 {
			ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00")
			fmt.Printf("[{%s}] Error: --farm requires at least one script path.\n", ts)
			os.Exit(1)
		}
		// Register endpoints
		reg := endpoint.NewRegistry()
		endpoint.RegisterAll(reg)
		if !script.RunFarm(*baseURL, reg, flag.Args(), *logDir, *timeout, *quiet, *local) {
			os.Exit(1)
		}
		return
	}

	app := cli.New(*baseURL, *persist, *quiet)

	// If there are remaining arguments, treat them as a single command line
	if flag.NArg() > 0 {
		app.ExecuteDirect(flag.Args())
		return
	}

	app.Run()
}
