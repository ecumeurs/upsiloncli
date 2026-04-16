package display

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/ecumeurs/upsiloncli/internal/dto"
)

// ANSI color codes
const (
	Reset   = "\033[0m"
	Bold    = "\033[1m"
	Dim     = "\033[2m"

	Red     = "\033[31m"
	Green   = "\033[32m"
	Yellow  = "\033[33m"
	Blue    = "\033[34m"
	Magenta = "\033[35m"
	Cyan    = "\033[36m"
	White   = "\033[37m"

	BgRed   = "\033[41m"
	BgGreen = "\033[42m"
)

// Printer handles formatted terminal output.
type Printer struct {
	Output io.Writer
	Prefix string
	Quiet  bool
}

// NewPrinter creates a new terminal printer writing to stdout.
func NewPrinter() *Printer {
	return &Printer{Output: os.Stdout}
}

// NewPrinterWithWriter creates a new terminal printer writing to the given writer.
func NewPrinterWithWriter(w io.Writer) *Printer {
	return &Printer{Output: w}
}

// WithPrefix returns a new printer with the given prefix.
func (p *Printer) WithPrefix(prefix string) *Printer {
	p.Prefix = prefix
	return p
}

// WithQuiet returns a new printer with the given quiet mode.
func (p *Printer) WithQuiet(quiet bool) *Printer {
	p.Quiet = quiet
	return p
}

// @spec-link [[rule_tracing_logging]]
// timestamp returns a UTC timestamp in the format required by project standards.
func (p *Printer) timestamp() string {
	return fmt.Sprintf("[{%s}] ", time.Now().UTC().Format(time.RFC3339))
}

// Curl prints the equivalent curl command for an API request.
func (p *Printer) Curl(method, url string, headers http.Header, body []byte) {
	if p.Quiet {
		// Just store for later comparison in Response, or print a tiny breadcrumb
		return
	}
	fmt.Fprintln(p.Output)
	fmt.Fprintf(p.Output, "%s%s%s[CURL]%s ", p.timestamp(), p.Prefix, Cyan+Bold, Reset)

	var parts []string
	parts = append(parts, "curl", "-X", method)

	for key, vals := range headers {
		if key == "Content-Type" || key == "Accept" || key == "Authorization" {
			parts = append(parts, "-H", fmt.Sprintf("'%s: %s'", key, vals[0]))
		}
	}

	if len(body) > 0 {
		parts = append(parts, "-d", fmt.Sprintf("'%s'", p.maskSensitive(body)))
	}

	parts = append(parts, fmt.Sprintf("'%s'", url))
	fmt.Fprintln(p.Output, Dim+strings.Join(parts, " ")+Reset)
}

// Wscat prints a manual wscat connection command.
func (p *Printer) Wscat(url string) {
	fmt.Fprintf(p.Output, "%s%s%s[WSCAT]%s %sconnect -c \"%s\"%s\n", p.timestamp(), p.Prefix, Magenta+Bold, Reset, Dim, url, Reset)
}

// WscatPayload prints a JSON payload for manual pusher subscription via wscat.
func (p *Printer) WscatPayload(channel, auth string) {
	fmt.Fprintln(p.Output)
	fmt.Fprintf(p.Output, "%s%s%s[WSCAT-SEND]%s To subscribe manually, paste this into wscat:\n", p.timestamp(), p.Prefix, Magenta+Bold, Reset)
	msg := map[string]interface{}{
		"event": "pusher:subscribe",
		"data": map[string]string{
			"channel": channel,
			"auth":    auth,
		},
	}
	raw, _ := json.Marshal(msg)
	fmt.Fprintln(p.Output, "  "+Dim+string(raw)+Reset)
}

// Response prints the HTTP status and pretty-printed JSON body.
func (p *Printer) Response(statusCode int, body []byte) {
	color := Green
	if statusCode >= 400 {
		color = Red
	} else if statusCode >= 300 {
		color = Yellow
	}

	if p.Quiet && statusCode < 400 {
		// Condensed output for successful requests in quiet mode
		fmt.Fprintf(p.Output, "%s%s%s[OK]%s %s %d\n", p.timestamp(), p.Prefix, color+Bold, Reset, Green+"Request successful"+Reset, statusCode)
		return
	}

	fmt.Fprintf(p.Output, "%s%s%s[REPLY %d]%s ", p.timestamp(), p.Prefix, color+Bold, statusCode, Reset)

	// Pretty-print JSON
	var pretty bytes.Buffer
	if err := json.Indent(&pretty, body, "  ", "  "); err == nil {
		fmt.Fprintln(p.Output)
		fmt.Fprintln(p.Output, "  "+Dim+pretty.String()+Reset)
	} else {
		fmt.Fprintln(p.Output, Dim+string(body)+Reset)
	}
}

// Print prints a generic message with the prefix.
func (p *Printer) Print(msg string) {
	fmt.Fprintf(p.Output, "%s%s%s\n", p.timestamp(), p.Prefix, msg)
}

// System prints a system-level informational message.
func (p *Printer) System(msg string) {
	fmt.Fprintf(p.Output, "%s%s%s[SYSTEM]%s %s\n", p.timestamp(), p.Prefix, Yellow+Bold, Reset, msg)
}

// Warn prints a warning message.
func (p *Printer) Warn(msg string) {
	fmt.Fprintf(p.Output, "%s%s%s[WARN]%s %s\n", p.timestamp(), p.Prefix, Red+Bold, Reset, msg)
}

// Suggestions prints a list of recommended next commands.
func (p *Printer) Suggestions(commands []string) {
	if len(commands) == 0 {
		return
	}
	var formatted []string
	for _, cmd := range commands {
		formatted = append(formatted, Green+cmd+Reset)
	}
	fmt.Fprintf(p.Output, "\n  %sSuggested next steps:%s %s\n", Dim, Reset, strings.Join(formatted, ", "))
}

// WebSocket prints a received WebSocket event.
func (p *Printer) WebSocket(eventType string, payload []byte) {
	fmt.Fprintf(p.Output, "\n%s%s%s[WS]%s %s event received.\n", p.timestamp(), p.Prefix, Magenta+Bold, Reset, eventType)

	displayPayload := payload
	// Reverb/Pusher data is often double-encoded as a JSON string
	var s string
	if err := json.Unmarshal(payload, &s); err == nil {
		displayPayload = []byte(s)
	}

	var pretty bytes.Buffer
	if err := json.Indent(&pretty, displayPayload, "  ", "  "); err == nil {
		fmt.Fprintln(p.Output, "  "+Dim+pretty.String()+Reset)
	} else {
		fmt.Fprintln(p.Output, "  "+Dim+string(displayPayload)+Reset)
	}
}

// Prompt displays a prompt for user input with an optional default value.
func (p *Printer) Prompt(name, hint, defaultVal string) string {
	if defaultVal != "" {
		fmt.Fprintf(p.Output, "  %s%s%s [default: %s%s%s]: ", Bold, name, Reset, Green, defaultVal, Reset)
	} else if hint != "" {
		fmt.Fprintf(p.Output, "  %s%s%s (%s): ", Bold, name, Reset, hint)
	} else {
		fmt.Fprintf(p.Output, "  %s%s%s: ", Bold, name, Reset)
	}
	return "" // actual reading is done by the caller
}

// RouteTable prints the endpoint registry as a table.
func (p *Printer) RouteTable(routes []RouteInfo) {
	fmt.Fprintln(p.Output)
	fmt.Fprintf(p.Output, "  %s%-25s %-8s %-40s %s%s\n", Bold, "ROUTE NAME", "VERB", "PATH", "DESCRIPTION", Reset)
	fmt.Fprintf(p.Output, "  %s%s%s\n", Dim, strings.Repeat("─", 100), Reset)
	for _, r := range routes {
		authMark := " "
		if r.Auth {
			authMark = "🔒"
		}
		fmt.Fprintf(p.Output, "  %-25s %-8s %-40s %s %s\n", Green+r.Name+Reset, r.Method, Dim+r.Path+Reset, r.Description, authMark)
	}
	fmt.Fprintln(p.Output)
}

// RouteInfo is used by RouteTable to describe a registered endpoint.
type RouteInfo struct {
	Name        string
	Method      string
	Path        string
	Description string
	Auth        bool
}

// SessionInfo prints the current session state.
func (p *Printer) SessionInfo(data map[string]string) {
	fmt.Fprintln(p.Output)
	fmt.Fprintf(p.Output, "  %sSession Context%s\n", Bold, Reset)
	fmt.Fprintf(p.Output, "  %s%s%s\n", Dim, strings.Repeat("─", 40), Reset)
	for k, v := range data {
		fmt.Fprintf(p.Output, "  %-20s %s\n", Cyan+k+Reset, v)
	}
	fmt.Fprintln(p.Output)
}

// Board renders the tactical map and entity status table.
func (p *Printer) Board(bs *dto.BoardState, currentUserID string, players []dto.Player) {
	if bs == nil {
		p.Warn("No board state available.")
		return
	}

	// 1. Identify Roles and Teams
	var myTeam int
	for _, p := range players {
		if p.IsSelf {
			myTeam = p.Team
			break
		}
	}

	entitySymbols := make(map[string]string)
	entityColors := make(map[string]string)
	nicknames := make(map[string]string)
	
	// Pre-sort entities for deterministic symbols
	allEntities := bs.Entities
	if len(allEntities) == 0 {
		// Flatten if missing (should be there if already mapped though)
		for _, p := range players {
			allEntities = append(allEntities, p.Entities...)
		}
	}

	for _, player := range players {
		nicknames[player.Nickname] = player.Nickname // Self-mapping
		color := Red
		if player.Team == myTeam {
			color = Green
		}
		
		// Determine symbols
		var syms []string
		if player.IsSelf {
			syms = []string{"A", "B", "C"}
		} else if player.Team == myTeam {
			syms = []string{"a", "b", "c"}
		} else {
			// Other teams
			syms = []string{"X", "Y", "Z"}
		}

		for i, ent := range player.Entities {
			if i < len(syms) {
				entitySymbols[ent.ID] = syms[i]
			} else {
				entitySymbols[ent.ID] = "?"
			}
			entityColors[ent.ID] = color
		}
	}

	// 2. Render Grid
	fmt.Fprintln(p.Output)
	fmt.Fprintf(p.Output, "%s%s%sTACTICAL FEED — MATCH DATA%s\n", p.timestamp(), p.Prefix, Cyan+Bold, Reset)
	fmt.Fprintf(p.Output, "%s%s%s%s%s\n", p.timestamp(), p.Prefix, Dim, strings.Repeat("─", 40), Reset)
	
	// ACTION FEEDBACK (One-liner)
	if bs.Action != nil {
		actorSym := entitySymbols[bs.Action.ActorID]
		actorColor := entityColors[bs.Action.ActorID]
		if actorSym == "" { actorSym = "?" }
		
		fmt.Fprintf(p.Output, "  %s[FEEDBACK]%s ", Magenta+Bold, Reset)
		
		switch bs.Action.Type {
		case "move":
			dist := len(bs.Action.Path)
			target := bs.Action.Path[dist-1]
			fmt.Fprintf(p.Output, "Unit %s%s%s moved %d tiles to (%d, %d)\n", actorColor+Bold, actorSym, Reset, dist, target.X, target.Y)
		case "attack":
			targetSym := entitySymbols[bs.Action.TargetID]
			targetColor := entityColors[bs.Action.TargetID]
			if targetSym == "" { targetSym = "?" }
			fmt.Fprintf(p.Output, "Unit %s%s%s hit Unit %s%s%s for %s%d DMG%s (%d -> %s%d HP%s)\n", 
				actorColor+Bold, actorSym, Reset, 
				targetColor+Bold, targetSym, Reset, 
				Red+Bold, bs.Action.Damage, Reset,
				bs.Action.PrevHP, Green+Bold, bs.Action.NewHP, Reset)
		case "pass":
			fmt.Fprintf(p.Output, "Unit %s%s%s passed their turn\n", actorColor+Bold, actorSym, Reset)
		}
		fmt.Fprintf(p.Output, "  %s%s%s\n", Dim, strings.Repeat("─", 40), Reset)
	}

	// Top border
	fmt.Fprint(p.Output, "    ")
	for x := 0; x < bs.Grid.Width; x++ {
		fmt.Fprintf(p.Output, "%2d", x)
	}
	fmt.Fprintln(p.Output)

	for y := 0; y < bs.Grid.Height; y++ {
		fmt.Fprintf(p.Output, "%2d │", y)
		for x := 0; x < bs.Grid.Width; x++ {
			cell := bs.Grid.Cells[y][x]
			if cell.EntityID != "" {
				sym := entitySymbols[cell.EntityID]
				color := entityColors[cell.EntityID]
				if cell.EntityID == bs.CurrentEntityID {
					fmt.Fprintf(p.Output, "%s%s%s ", color+Bold+BgGreen, sym, Reset) 
				} else {
					fmt.Fprintf(p.Output, "%s%s%s ", color+Bold, sym, Reset)
				}
			} else if cell.Obstacle {
				fmt.Fprintf(p.Output, "%s#%s ", Dim, Reset)
			} else {
				fmt.Fprintf(p.Output, "%s.%s ", Dim, Reset)
			}
		}
		fmt.Fprintln(p.Output, "│")
	}

	// Map entity ID to delay
	delays := make(map[string]int)
	for _, t := range bs.Turn {
		delays[t.EntityID] = t.Delay
	}

	// 3. Entity List
	fmt.Fprintln(p.Output)
	fmt.Fprintf(p.Output, "  %s%-3s %-15s %-12s %-10s %-7s %-5s %s\n", Bold, "ID", "UNIT NAME", "OWNER", "HP/MAX", "MVT", "DELAY", Reset)
	fmt.Fprintf(p.Output, "  %s%s%s\n", Dim, strings.Repeat("─", 70), Reset)

	// Sort entities by symbol for the list
	sort.Slice(allEntities, func(i, j int) bool {
		symI := entitySymbols[allEntities[i].ID]
		symJ := entitySymbols[allEntities[j].ID]
		return symI < symJ
	})

	for _, ent := range allEntities {
		if ent.HP <= 0 {
			continue // Hide dead units
		}
		sym := entitySymbols[ent.ID]
		color := entityColors[ent.ID]
		
		// Owner info
		var owner string
		for _, p := range players {
			for _, e := range p.Entities {
				if e.ID == ent.ID {
					owner = p.Nickname
					break
				}
			}
			if owner != "" { break }
		}

		if ent.ID == bs.CurrentEntityID {
			fmt.Fprint(p.Output, Cyan+"> "+Reset)
		} else {
			fmt.Fprint(p.Output, "  ")
		}
		
		delayStr := fmt.Sprintf("%d", delays[ent.ID])

		fmt.Fprintf(p.Output, "%s%s%s %-15s %-12s %-10s %-7s %-5s\n",
			color+Bold, sym, Reset,
			ent.Name,
			owner,
			fmt.Sprintf("%d/%d", ent.HP, ent.MaxHP),
			fmt.Sprintf("%d/%d", ent.Move, ent.MaxMove),
			delayStr,
		)
	}
	fmt.Fprintln(p.Output)
}

// Victory prints a large success banner.
func (p *Printer) Victory(name string) {
	fmt.Fprintln(p.Output)
	ts := p.timestamp()
	fmt.Fprintf(p.Output, "  %s%s%s%s%s\n", ts, p.Prefix, BgGreen+White+Bold, "                                        ", Reset)
	fmt.Fprintf(p.Output, "  %s%s%s%s%s\n", ts, p.Prefix, BgGreen+White+Bold, "     VICTORY IS YOURS, "+strings.ToUpper(name)+"!     ", Reset)
	fmt.Fprintf(p.Output, "  %s%s%s%s%s\n", ts, p.Prefix, BgGreen+White+Bold, "                                        ", Reset)
	fmt.Fprintln(p.Output)
}

// Defeat prints a large failure banner.
func (p *Printer) Defeat(winner string) {
	fmt.Fprintln(p.Output)
	ts := p.timestamp()
	fmt.Fprintf(p.Output, "  %s%s%s%s%s\n", ts, p.Prefix, BgRed+White+Bold, "                                        ", Reset)
	fmt.Fprintf(p.Output, "  %s%s%s%s%s\n", ts, p.Prefix, BgRed+White+Bold, "     DEFEAT... WINNER: "+strings.ToUpper(winner)+"     ", Reset)
	fmt.Fprintf(p.Output, "  %s%s%s%s%s\n", ts, p.Prefix, BgRed+White+Bold, "                                        ", Reset)
	fmt.Fprintln(p.Output)
}

// Draw prints a stalemate banner.
func (p *Printer) Draw() {
	fmt.Fprintln(p.Output)
	ts := p.timestamp()
	fmt.Fprintf(p.Output, "  %s%s%s%s\n", ts, Yellow+Bold, "                                        ", Reset)
	fmt.Fprintf(p.Output, "  %s%s%s%s\n", ts, Yellow+Bold, "          STALEMATE / DRAW          ", Reset)
	fmt.Fprintf(p.Output, "  %s%s%s%s\n", ts, Yellow+Bold, "                                        ", Reset)
	fmt.Fprintln(p.Output)
}

// @spec-link [[mechanic_mech_cli_sensitive_data_masking]]
// maskSensitive hides password-like fields in JSON bodies.
func (p *Printer) maskSensitive(body []byte) string {
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return string(body)
	}

	sensitiveKeys := []string{"password", "password_confirmation", "current_password", "token"}

	masked := false
	for _, key := range sensitiveKeys {
		if _, ok := data[key]; ok {
			data[key] = "********"
			masked = true
		}
	}

	if !masked {
		// Try recursive masking for nested structures if needed in the future.
		// For now, these are the primary targets for login/register.
		return string(body)
	}

	newBody, err := json.Marshal(data)
	if err != nil {
		return string(body)
	}
	return string(newBody)
}
