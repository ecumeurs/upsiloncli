// Package api provides the HTTP client that wraps every call
// with curl logging, response pretty-printing, and JWT injection.
package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/ecumeurs/upsiloncli/internal/display"
	"github.com/ecumeurs/upsiloncli/internal/session"
)

// Client is the HTTP client used by all endpoint handlers.
type Client struct {
	BaseURL    string
	HTTPClient *http.Client
	Session    *session.Session
	Printer    *display.Printer
}

// NewClient creates an API client targeting the given base URL.
func NewClient(baseURL string, sess *session.Session, printer *display.Printer) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		Session: sess,
		Printer: printer,
	}
}

// Response is the parsed standard envelope returned by the API.
type Response struct {
	StatusCode int
	Success    bool                   `json:"success"`
	Message    string                 `json:"message"`
	Data       interface{}            `json:"data"`
	Meta       map[string]interface{} `json:"meta"`
	RequestID  string                 `json:"request_id"`
	RawBody    string
}

// Do executes an HTTP request, logs the curl command and response,
// and handles JWT renewal transparently.
func (c *Client) Do(method, path string, body interface{}) (*Response, error) {
	fullURL := c.BaseURL + path

	// Serialize body
	var bodyReader io.Reader
	var bodyBytes []byte
	if body != nil {
		var err error
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	// Build request
	req, err := http.NewRequest(method, fullURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	if token := c.Session.Token(); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	// Log curl
	c.Printer.Curl(method, fullURL, req.Header, bodyBytes)

	// Execute
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	// Parse envelope
	var parsed Response
	parsed.StatusCode = resp.StatusCode
	parsed.RawBody = string(rawBody)

	if err := json.Unmarshal(rawBody, &parsed); err != nil {
		// Non-JSON response — just store raw
		parsed.Message = "non-JSON response"
	}

	// Log response
	c.Printer.Response(resp.StatusCode, rawBody)

	// Handle JWT renewal from meta.token
	if renewed := c.Session.HandleTokenRenewal(parsed.Meta); renewed {
		c.Printer.System("Token renewed and cached.")
	}

	return &parsed, nil
}

// Get is a convenience wrapper for GET requests.
func (c *Client) Get(path string) (*Response, error) {
	return c.Do("GET", path, nil)
}

// GetWithParams is a convenience wrapper for GET requests with query parameters.
func (c *Client) GetWithParams(path string, params map[string]string) (*Response, error) {
	if len(params) > 0 {
		var q []string
		for k, v := range params {
			q = append(q, fmt.Sprintf("%s=%s", k, v))
		}
		path += "?" + strings.Join(q, "&")
	}
	return c.Get(path)
}

// Post is a convenience wrapper for POST requests.
func (c *Client) Post(path string, body interface{}) (*Response, error) {
	return c.Do("POST", path, body)
}

// Delete is a convenience wrapper for DELETE requests.
func (c *Client) Delete(path string) (*Response, error) {
	return c.Do("DELETE", path, nil)
}
