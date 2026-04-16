// Package endpoint defines the route registry and the Endpoint interface
// that every API route handler must implement.
package endpoint

import (
	"github.com/ecumeurs/upsiloncli/internal/api"
	"github.com/ecumeurs/upsiloncli/internal/display"
	"github.com/ecumeurs/upsiloncli/internal/session"
)

// Param describes a single input parameter for an endpoint.
type Param struct {
	Name       string // Parameter name (e.g., "account_name")
	Hint       string // Descriptive hint (e.g., "your email address")
	Required   bool   // If true, user cannot skip
	ContextKey string // Session context key to use as default (e.g., "match_id")
	Secret     bool   // If true, input is masked and hidden in logs/curl
}

// Endpoint is the interface every API route must implement.
type Endpoint interface {
	// Name returns the unique route_name identifier.
	Name() string

	// Description returns a short human-readable description.
	Description() string

	// Method returns the HTTP verb (GET, POST, DELETE, etc.).
	Method() string

	// Path returns the URL path template (e.g., "/api/v1/game/{match_id}/action").
	Path() string

	// Auth returns true if the endpoint requires a JWT.
	Auth() bool

	// Params returns the list of input parameters for interactive prompting.
	Params() []Param

	// Execute runs the endpoint using the collected inputs.
	// It receives the resolved parameter map (name -> user-provided value).
	Execute(client *api.Client, sess *session.Session, inputs map[string]string) error

	// ExecuteRaw runs the endpoint and returns the full API response.
	ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error)

	// Next returns a list of route_name identifiers that typically follow this endpoint.
	Next() []string
}

// Registry holds all registered endpoints indexed by route_name.
type Registry struct {
	endpoints map[string]Endpoint
	order     []string // preserve insertion order for display
}

// NewRegistry creates an empty endpoint registry.
func NewRegistry() *Registry {
	return &Registry{
		endpoints: make(map[string]Endpoint),
	}
}

// Register adds an endpoint to the registry.
func (r *Registry) Register(ep Endpoint) {
	r.endpoints[ep.Name()] = ep
	r.order = append(r.order, ep.Name())
}

// Get retrieves an endpoint by route_name. Returns nil if not found.
func (r *Registry) Get(name string) Endpoint {
	return r.endpoints[name]
}

// List returns all registered endpoints as RouteInfo for display.
func (r *Registry) List() []display.RouteInfo {
	var out []display.RouteInfo
	for _, name := range r.order {
		ep := r.endpoints[name]
		out = append(out, display.RouteInfo{
			Name:        ep.Name(),
			Method:      ep.Method(),
			Path:        ep.Path(),
			Description: ep.Description(),
			Auth:        ep.Auth(),
		})
	}
	return out
}

// Names returns all route_name identifiers in order.
func (r *Registry) Names() []string {
	return r.order
}
