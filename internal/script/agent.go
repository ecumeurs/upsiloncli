package script

import (
	"fmt"
	"io"

	"context"
	"github.com/dop251/goja"
	"github.com/ecumeurs/upsiloncli/internal/api"
	"github.com/ecumeurs/upsiloncli/internal/display"
	"github.com/ecumeurs/upsiloncli/internal/endpoint"
	"github.com/ecumeurs/upsiloncli/internal/session"
	"github.com/ecumeurs/upsiloncli/internal/ws"
)

type Agent struct {
	ID           string
	AgentIndex   int
	AgentCount   int
	Session      *session.Session
	Display      *display.Printer
	Client       *api.Client
	Listener     *ws.Listener
	Registry     *endpoint.Registry
	VM           *goja.Runtime
	Logger       io.Writer
	TeardownHook goja.Callable
	GoTeardownHook func()
	Shared       *SharedStore
	Ctx          context.Context
	lastConsumedVersion uint64
	currentTurnEntityID string
	hasAttackedThisTurn bool
}

func NewAgent(id string, agentIdx, agentCount int, baseURL string, reg *endpoint.Registry, logger io.Writer, shared *SharedStore, quiet bool) *Agent {
	sess := session.New()
	printer := display.NewPrinterWithWriter(logger).
		WithPrefix(fmt.Sprintf("[%s] ", id)).
		WithQuiet(quiet)
	client := api.NewClient(baseURL, sess, printer)
	
	agent := &Agent{
		ID:         id,
		AgentIndex: agentIdx,
		AgentCount: agentCount,
		Session:    sess,
		Display:    printer,
		Client:     client,
		Listener:   ws.NewListener(client, sess, printer),
		Registry:   reg,
		VM:         goja.New(),
		Logger:     logger,
		Shared:     shared,
	}

	// Use JSON tags for Go struct field names in JS (consistent with API keys)
	agent.VM.SetFieldNameMapper(goja.TagFieldNameMapper("json", true))

	agent.bindJSAPI()
	return agent
}

