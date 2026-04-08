// Package hiveagent provides a Go client for the HiveAgent MCP API.
// HiveAgent is an MCP-native marketplace with 828 tools across 40 verticals,
// supporting AI agent workflows, DeFi, payments, ZK proofs, and more.
//
// Quick start:
//
//	client := hiveagent.New(hiveagent.WithAgentID("agent_xxx"))
//	result, err := client.CallTool("web_search", map[string]interface{}{
//	    "query": "latest AI news",
//	})
//
// See https://hiveagentiq.com for full documentation.
package hiveagent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	// DefaultEndpoint is the production MCP gateway endpoint.
	DefaultEndpoint = "https://hiveagentiq.com/mcp"

	// SandboxEndpoint is the sandbox endpoint — all calls are mocked and free.
	SandboxEndpoint = "https://hiveagentiq.com/mcp/sandbox"

	// Version is the current SDK version.
	Version = "0.1.0"
)

// Client is the HiveAgent MCP client.
type Client struct {
	Endpoint   string
	AgentID    string
	Sandbox    bool
	Timeout    time.Duration
	httpClient *http.Client
	reqID      int
}

// Option is a functional option for configuring a Client.
type Option func(*Client)

// WithEndpoint sets a custom MCP endpoint URL.
func WithEndpoint(e string) Option {
	return func(c *Client) { c.Endpoint = e }
}

// WithAgentID sets the agent identifier sent on every request.
// Required for production calls. Obtain your agent ID from https://hiveagentiq.com.
func WithAgentID(id string) Option {
	return func(c *Client) { c.AgentID = id }
}

// WithSandbox routes all calls to the sandbox endpoint.
// Sandbox responses are schema-valid mocks — no real transactions occur
// and calls are always free.
func WithSandbox() Option {
	return func(c *Client) {
		c.Sandbox = true
		c.Endpoint = SandboxEndpoint
	}
}

// WithTimeout sets the HTTP request timeout (default: 30s).
func WithTimeout(d time.Duration) Option {
	return func(c *Client) {
		c.Timeout = d
		c.httpClient.Timeout = d
	}
}

// WithHTTPClient replaces the underlying *http.Client (for custom transports, proxies, etc.).
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) { c.httpClient = hc }
}

// New creates a new HiveAgent client with the given options.
// Defaults: production endpoint, 30s timeout.
func New(opts ...Option) *Client {
	c := &Client{
		Endpoint: DefaultEndpoint,
		Timeout:  30 * time.Second,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

// ─────────────────────────────────────────
// MCP protocol types
// ─────────────────────────────────────────

// MCPRequest is a JSON-RPC 2.0 request for the MCP protocol.
type MCPRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

// MCPResponse is a JSON-RPC 2.0 response from the MCP protocol.
type MCPResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *MCPError       `json:"error,omitempty"`
}

// MCPError represents a JSON-RPC error object.
type MCPError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

func (e *MCPError) Error() string {
	return fmt.Sprintf("MCP error %d: %s", e.Code, e.Message)
}

// ─────────────────────────────────────────
// Core methods
// ─────────────────────────────────────────

// CallTool calls any HiveAgent tool by name with the given arguments.
// Returns the raw JSON result or an error.
//
//	result, err := client.CallTool("web_search", map[string]interface{}{
//	    "query": "HiveAgent MCP",
//	})
func (c *Client) CallTool(name string, args map[string]interface{}) (json.RawMessage, error) {
	return c.CallToolContext(context.Background(), name, args)
}

// CallToolContext is like CallTool but accepts a context for cancellation and deadlines.
func (c *Client) CallToolContext(ctx context.Context, name string, args map[string]interface{}) (json.RawMessage, error) {
	params := map[string]interface{}{
		"name":      name,
		"arguments": args,
	}
	if c.AgentID != "" {
		params["agent_id"] = c.AgentID
	}
	if c.Sandbox {
		params["sandbox"] = true
	}

	resp, err := c.doRequest(ctx, "tools/call", params)
	if err != nil {
		return nil, err
	}
	return resp.Result, nil
}

// ListTools returns the full list of available tools from the HiveAgent registry.
func (c *Client) ListTools() ([]Tool, error) {
	return c.ListToolsContext(context.Background())
}

// ListToolsContext is like ListTools but accepts a context.
func (c *Client) ListToolsContext(ctx context.Context) ([]Tool, error) {
	resp, err := c.doRequest(ctx, "tools/list", nil)
	if err != nil {
		return nil, err
	}

	var out struct {
		Tools []Tool `json:"tools"`
	}
	if err := json.Unmarshal(resp.Result, &out); err != nil {
		return nil, fmt.Errorf("hiveagent: failed to decode tools/list response: %w", err)
	}
	return out.Tools, nil
}

// Discover performs natural language tool discovery — returns ranked matches
// for the given query string. Useful for agents that need to find the right
// tool without knowing its exact name.
//
//	matches, err := client.Discover("file a parametric insurance claim")
func (c *Client) Discover(query string) ([]ToolMatch, error) {
	return c.DiscoverContext(context.Background(), query)
}

// DiscoverContext is like Discover but accepts a context.
func (c *Client) DiscoverContext(ctx context.Context, query string) ([]ToolMatch, error) {
	raw, err := c.CallToolContext(ctx, "hiveagent_discover", map[string]interface{}{
		"query": query,
	})
	if err != nil {
		return nil, err
	}

	var matches []ToolMatch
	if err := json.Unmarshal(raw, &matches); err != nil {
		return nil, fmt.Errorf("hiveagent: failed to decode discover response: %w", err)
	}
	return matches, nil
}

// Ping checks that the MCP gateway is reachable. Returns nil on success.
func (c *Client) Ping() error {
	return c.PingContext(context.Background())
}

// PingContext is like Ping but accepts a context.
func (c *Client) PingContext(ctx context.Context) error {
	_, err := c.CallToolContext(ctx, "hiveagent_ping", nil)
	return err
}

// ─────────────────────────────────────────
// Internal HTTP helpers
// ─────────────────────────────────────────

func (c *Client) nextID() int {
	c.reqID++
	return c.reqID
}

func (c *Client) doRequest(ctx context.Context, method string, params interface{}) (*MCPResponse, error) {
	reqBody := MCPRequest{
		JSONRPC: "2.0",
		ID:      c.nextID(),
		Method:  method,
		Params:  params,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("hiveagent: failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("hiveagent: failed to create HTTP request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "hiveagent-go/"+Version)
	if c.AgentID != "" {
		req.Header.Set("X-Agent-ID", c.AgentID)
	}

	httpResp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("hiveagent: HTTP request failed: %w", err)
	}
	defer httpResp.Body.Close()

	respBytes, err := io.ReadAll(io.LimitReader(httpResp.Body, 10<<20)) // 10 MB max
	if err != nil {
		return nil, fmt.Errorf("hiveagent: failed to read response body: %w", err)
	}

	if httpResp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("hiveagent: rate limit exceeded (429). Check X-RateLimit-Reset header. Upgrade at https://hiveagentiq.com/pricing")
	}
	if httpResp.StatusCode >= 500 {
		return nil, fmt.Errorf("hiveagent: server error %d: %s", httpResp.StatusCode, string(respBytes))
	}

	var mcpResp MCPResponse
	if err := json.Unmarshal(respBytes, &mcpResp); err != nil {
		return nil, fmt.Errorf("hiveagent: failed to decode response (status %d): %w", httpResp.StatusCode, err)
	}
	if mcpResp.Error != nil {
		return nil, mcpResp.Error
	}
	return &mcpResp, nil
}
