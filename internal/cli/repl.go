// Package cli provides the interactive REPL loop and command dispatcher.
package cli

import (
	"fmt"
	"strings"

	"github.com/chzyer/readline"
	"github.com/ecumeurs/upsiloncli/internal/api"
	"github.com/ecumeurs/upsiloncli/internal/display"
	"github.com/ecumeurs/upsiloncli/internal/endpoint"
	"github.com/ecumeurs/upsiloncli/internal/session"
	"github.com/ecumeurs/upsiloncli/internal/ws"
)

// CLI is the interactive command-line application.
type CLI struct {
	Session  *session.Session
	Client   *api.Client
	Printer  *display.Printer
	Registry *endpoint.Registry
	ReadLine *readline.Instance
	Listener *ws.Listener
	Persist  bool
}

const sessionFile = ".upsilon_session.json"

// New creates a new CLI instance.
func New(baseURL string, persist bool, quiet bool) *CLI {
	sess := session.New()
	if persist {
		if err := sess.LoadFromFile(sessionFile); err != nil {
			// Silently fail if file doesn't exist yet
		}
	}

	printer := display.NewPrinter().WithQuiet(quiet)
	client := api.NewClient(baseURL, sess, printer)
	reg := endpoint.NewRegistry()
	endpoint.RegisterAll(reg)

	return &CLI{
		Session:  sess,
		Client:   client,
		Printer:  printer,
		Registry: reg,
		Listener: ws.NewListener(client, sess, printer),
		Persist:  persist,
	}
}

// Run starts the interactive REPL loop.
func (c *CLI) Run() {
	// Build completer
	var callItems []readline.PrefixCompleterInterface
	for _, name := range c.Registry.Names() {
		callItems = append(callItems, readline.PcItem(name))
	}

	completer := readline.NewPrefixCompleter(
		readline.PcItem("routes"),
		readline.PcItem("call", callItems...),
		readline.PcItem("jwt"),
		readline.PcItem("session"),
		readline.PcItem("redraw"),
		readline.PcItem("status"),
		readline.PcItem("help"),
		readline.PcItem("exit"),
	)

	// Add shortcut routes to root completer
	for _, name := range c.Registry.Names() {
		completer.Children = append(completer.Children, readline.PcItem(name))
	}

	rl, err := readline.NewEx(&readline.Config{
		Prompt:          fmt.Sprintf("\001%s\002[\001%s\002]\001%s\002 > ", display.Cyan, c.Session.String(), display.Reset),
		AutoComplete:    completer,
		InterruptPrompt: "^C",
		EOFPrompt:       "exit",
	})
	if err != nil {
		panic(err)
	}
	c.ReadLine = rl
	c.printBanner()
	defer c.ReadLine.Close()

	// Start WebSocket listener in background
	c.Listener.Start()

	for {
		// Update prompt dynamically with current session state
		c.ReadLine.SetPrompt(fmt.Sprintf("\001%s\002[\001%s\002]\001%s\002 > ", display.Cyan, c.Session.String(), display.Reset))

		line, err := c.ReadLine.Readline()
		if err != nil { // io.EOF or ctrl-c
			break
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Fields(line)
		cmd := strings.ToLower(parts[0])
		args := parts[1:]

		switch cmd {
		case "exit", "quit", "q":
			fmt.Println("Goodbye.")
			return

		case "help", "h", "?":
			c.printHelp()

		case "routes":
			c.Printer.RouteTable(c.Registry.List())

		case "call":
			if len(args) == 0 {
				c.Printer.Warn("Usage: call <route_name>")
				continue
			}
			c.executeEndpoint(args[0], nil)

		case "jwt":
			if len(args) == 0 {
				// Display current JWT
				token := c.Session.Token()
				if token == "" {
					c.Printer.System("No JWT token set.")
				} else {
					c.Printer.System(fmt.Sprintf("Current JWT: %s", token))
				}
			} else {
				// Override JWT
				c.Session.SetToken(args[0])
				c.Printer.Warn("JWT manually overridden. All further requests will use this token.")
			}

		case "session":
			c.Printer.SessionInfo(c.Session.Dump())

		case "redraw":
			bs := c.Session.LastBoard()
			parts := c.Session.Participants()
			if bs != nil {
				// Identify ourself using either UUID or Nickname
				ident := c.Session.UserIdentifier()
				c.Printer.Board(bs, ident, parts)
			} else {
				c.Printer.Warn("No board state cached. Use 'call game_state' first or wait for a push update.")
			}

		case "status":
			c.handleStatus()

		default:
			// Check if it's a valid route_name shortcut
			if ep := c.Registry.Get(cmd); ep != nil {
				c.executeEndpoint(cmd, nil)
			} else {
				c.Printer.Warn(fmt.Sprintf("Unknown command: %q. Type 'help' for available commands.", cmd))
			}
		}
	}
}

// ExecuteDirect runs a single command sequence from CLI arguments and exits.
func (c *CLI) ExecuteDirect(args []string) {
	cmd := strings.ToLower(args[0])
	cmdArgs := args[1:]

	switch cmd {
	case "routes":
		c.Printer.RouteTable(c.Registry.List())
	case "call":
		if len(cmdArgs) > 0 {
			c.executeEndpoint(cmdArgs[0], cmdArgs[1:])
		}
	case "session":
		c.Printer.SessionInfo(c.Session.Dump())
	case "status":
		c.handleStatus()
	default:
		// Attempt shortcut call
		if ep := c.Registry.Get(cmd); ep != nil {
			c.executeEndpoint(cmd, cmdArgs)
		} else {
			c.Printer.Warn(fmt.Sprintf("Unknown command: %q", cmd))
		}
	}

	if c.Persist {
		c.Session.SaveToFile(sessionFile)
	}
}

// executeEndpoint runs an endpoint by name, prompting for parameters.
func (c *CLI) executeEndpoint(name string, cliArgs []string) {
	ep := c.Registry.Get(name)
	if ep == nil {
		c.Printer.Warn(fmt.Sprintf("Unknown route: %q. Use 'routes' to list available endpoints.", name))
		return
	}

	// Parse CLI key=value arguments
	cliInputs := make(map[string]string)
	for _, arg := range cliArgs {
		if strings.Contains(arg, "=") {
			parts := strings.SplitN(arg, "=", 2)
			cliInputs[parts[0]] = parts[1]
		}
	}

	// Check auth requirement
	if ep.Auth() && !c.Session.HasToken() {
		c.Printer.Warn("This endpoint requires authentication. Use 'call auth_login' or 'call auth_register' first.")
		return
	}

	// Collect parameters
	params := ep.Params()
	inputs := make(map[string]string)

	for _, p := range params {
		// Priority 1: CLI argument override
		if val, ok := cliInputs[p.Name]; ok {
			inputs[p.Name] = val
			continue
		}

		// Priority 2: Resolve default from session context
		defaultVal := ""
		if p.ContextKey != "" {
			if v, ok := c.Session.Get(p.ContextKey); ok {
				defaultVal = v
			}
		}

		// Prompt user if not provided in CLI args
		value := c.prompt(p.Name, p.Hint, defaultVal, p.Required, p.Secret)
		inputs[p.Name] = value
	}

	// Execute
	if err := ep.Execute(c.Client, c.Session, inputs); err != nil {
		c.Printer.Warn(fmt.Sprintf("Error: %v", err))
		return
	}

	// Save session if persistence is enabled
	if c.Persist {
		c.Session.SaveToFile(sessionFile)
	}

	// Sync WebSocket subscriptions
	c.Listener.Sync()

	// Suggest next routes (only in interactive mode)
	if len(cliArgs) == 0 {
		next := ep.Next()
			if len(next) > 0 {
				c.Printer.Suggestions(next)
			}
	}
}

func (c *CLI) handleStatus() {
	fmt.Println()
	fmt.Printf("  %sEnd-to-End Connectivity Status%s\n", display.Bold, display.Reset)
	fmt.Printf("  %s%s%s\n", display.Dim, strings.Repeat("─", 50), display.Reset)

	// 1. API Check
	apiStatus := display.Red + "OFFLINE" + display.Reset
	if _, err := c.Client.Get("/api/v1/help"); err == nil {
		apiStatus = display.Green + "ONLINE" + display.Reset
	}
	fmt.Printf("  %-20s %s\n", "Laravel API:", apiStatus)

	// 2. Session Check
	sessStatus := display.Red + "UNAUTHENTICATED" + display.Reset
	if c.Session.HasToken() {
		sessStatus = display.Green + "AUTHENTICATED" + display.Reset
	}
	fmt.Printf("  %-20s %s\n", "Session Status:", sessStatus)

	// 3. WebSocket Check
	wsConn, wsSocket, wsSubs := c.Listener.Status()
	wsStatus := display.Red + "DISCONNECTED" + display.Reset
	if wsConn {
		if wsSocket != "" {
			wsStatus = display.Green + "CONNECTED (Handshake OK)" + display.Reset
		} else {
			wsStatus = display.Yellow + "CONNECTED (Waiting for Handshake)" + display.Reset
		}
	}
	fmt.Printf("  %-20s %s\n", "WebSocket Link:", wsStatus)
	if wsSocket != "" {
		fmt.Printf("  %-20s %s%s%s\n", "Socket ID:", display.Dim, wsSocket, display.Reset)
	}

	// 4. Subscriptions
	fmt.Printf("  %-20s ", "Subscriptions:")
	if len(wsSubs) > 0 {
		fmt.Println(display.Cyan + strings.Join(wsSubs, ", ") + display.Reset)
	} else {
		fmt.Println(display.Dim + "None" + display.Reset)
	}
	fmt.Println()
}

// @spec-link [[mechanic_mech_cli_sensitive_data_masking]]
// prompt asks the user for a value, showing the default if available.
func (c *CLI) prompt(name, hint, defaultVal string, required, secret bool) string {
	for {
		var promptStr string
		if defaultVal != "" {
			promptStr = fmt.Sprintf("  \001%s\002%s\001%s\002 [default: \001%s\002%s\001%s\002]: ", display.Bold, name, display.Reset, display.Green, defaultVal, display.Reset)
		} else if hint != "" {
			promptStr = fmt.Sprintf("  \001%s\002%s\001%s\002 (%s): ", display.Bold, name, display.Reset, hint)
		} else {
			promptStr = fmt.Sprintf("  \001%s\002%s\001%s\002: ", display.Bold, name, display.Reset)
		}

		if c.ReadLine == nil {
			// Non-interactive fallback
			fmt.Print(promptStr)
			var value string
			fmt.Scanln(&value)
			value = strings.TrimSpace(value)
			if value == "" && defaultVal != "" {
				return defaultVal
			}
			if value == "" && required {
				c.Printer.Warn(fmt.Sprintf("%s is required.", name))
				continue
			}
			return value
		}

		c.ReadLine.SetPrompt(promptStr)
		// Disable autocomplete temporarily for parameter input
		oldCompleter := c.ReadLine.Config.AutoComplete
		c.ReadLine.Config.AutoComplete = nil

		var line string
		var err error

		if secret {
			var pbytes []byte
			pbytes, err = c.ReadLine.ReadPassword(promptStr)
			line = string(pbytes)
		} else {
			line, err = c.ReadLine.Readline()
		}

		c.ReadLine.Config.AutoComplete = oldCompleter
		if err != nil {
			return ""
		}
		value := strings.TrimSpace(line)

		if value == "" && defaultVal != "" {
			return defaultVal
		}
		if value == "" && required {
			c.Printer.Warn(fmt.Sprintf("%s is required.", name))
			continue
		}
		return value
	}
}

func (c *CLI) printBanner() {
	fmt.Println()
	fmt.Println(display.Cyan + display.Bold + "  ╔══════════════════════════════════════════╗" + display.Reset)
	fmt.Println(display.Cyan + display.Bold + "  ║       ⌬ UpsilonCLI — API Explorer        ║" + display.Reset)
	fmt.Println(display.Cyan + display.Bold + "  ╚══════════════════════════════════════════╝" + display.Reset)
	fmt.Printf("  Target: %s%s%s\n", display.Dim, c.Client.BaseURL, display.Reset)
	fmt.Println()
	fmt.Println("  Type 'help' for commands, 'routes' to see all endpoints.")
}

func (c *CLI) printHelp() {
	fmt.Println()
	fmt.Printf("  %sAvailable Commands%s\n", display.Bold, display.Reset)
	fmt.Printf("  %s%s%s\n", display.Dim, strings.Repeat("─", 50), display.Reset)
	fmt.Printf("  %-22s %s\n", display.Green+"routes"+display.Reset, "List all API endpoints with route_name identifiers")
	fmt.Printf("  %-22s %s\n", display.Green+"call <route_name>"+display.Reset, "Execute an endpoint interactively")
	fmt.Printf("  %-22s %s\n", display.Green+"jwt"+display.Reset, "Display current JWT token")
	fmt.Printf("  %-22s %s\n", display.Green+"jwt <token>"+display.Reset, "Manually override the JWT (for testing)")
	fmt.Printf("  %-22s %s\n", display.Green+"session"+display.Reset, "Display current session context")
	fmt.Printf("  %-22s %s\n", display.Green+"redraw"+display.Reset, "Re-render last known tactical board")
	fmt.Printf("  %-22s %s\n", display.Green+"status"+display.Reset, "Check end-to-end connectivity status (API & WS)")
	fmt.Printf("  %-22s %s\n", display.Green+"help"+display.Reset, "Show this help message")
	fmt.Printf("  %-22s %s\n", display.Green+"exit"+display.Reset, "Quit the CLI")
	fmt.Println()
	fmt.Printf("  %sTip:%s You can also type a route_name directly (e.g., 'auth_login').\n", display.Dim, display.Reset)
}
