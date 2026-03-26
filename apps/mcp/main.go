package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type config struct {
	addr    string
	baseURL string
}

type queryArgs struct {
	Service string `json:"service"`
	Query   string `json:"query"`
}

type logArgs struct {
	Service string `json:"service"`
	Keyword string `json:"keyword"`
}

type mysqlArgs struct {
	Service   string `json:"service"`
	Statement string `json:"statement"`
}

type runbookArgs struct {
	Service string `json:"service"`
	Query   string `json:"query"`
}

func main() {
	cfg := loadConfig()

	s := server.NewMCPServer(
		"aegisflow-mcp",
		"1.0.0",
		server.WithToolCapabilities(false),
	)

	s.AddTool(
		mcp.NewTool(
			"prometheus.query",
			mcp.WithDescription("Query Prometheus-style operational metrics for a service"),
			mcp.WithString("service", mcp.Required(), mcp.Description("Target service name")),
			mcp.WithString("query", mcp.Required(), mcp.Description("PromQL-like query content")),
		),
		mcp.NewTypedToolHandler(prometheusQuery),
	)
	s.AddTool(
		mcp.NewTool(
			"logs.search",
			mcp.WithDescription("Search recent error logs for a service"),
			mcp.WithString("service", mcp.Required(), mcp.Description("Target service name")),
			mcp.WithString("keyword", mcp.Required(), mcp.Description("Search keyword or Lucene-like expression")),
		),
		mcp.NewTypedToolHandler(logSearch),
	)
	s.AddTool(
		mcp.NewTool(
			"mysql.query",
			mcp.WithDescription("Query summarized slow SQL information for a service"),
			mcp.WithString("service", mcp.Required(), mcp.Description("Target service name")),
			mcp.WithString("statement", mcp.Required(), mcp.Description("SQL-like diagnostic statement")),
		),
		mcp.NewTypedToolHandler(mysqlQuery),
	)
	s.AddTool(
		mcp.NewTool(
			"runbook.search",
			mcp.WithDescription("Search internal runbook snippets for a service or incident keyword"),
			mcp.WithString("service", mcp.Required(), mcp.Description("Target service name")),
			mcp.WithString("query", mcp.Required(), mcp.Description("Natural language query for the runbook corpus")),
		),
		mcp.NewTypedToolHandler(runbookSearch),
	)

	sseServer := server.NewSSEServer(
		s,
		server.WithBaseURL(cfg.baseURL),
		server.WithSSEEndpoint("/sse"),
		server.WithMessageEndpoint("/message"),
	)

	log.Printf("starting aegisflow mcp server on %s", cfg.addr)
	log.Printf("sse endpoint: %s/sse", cfg.baseURL)
	if err := sseServer.Start(cfg.addr); err != nil {
		log.Fatalf("mcp server failed: %v", err)
	}
}

func loadConfig() config {
	addr := os.Getenv("AEGISFLOW_MCP_ADDR")
	if addr == "" {
		addr = ":8090"
	}
	baseURL := os.Getenv("AEGISFLOW_MCP_BASE_URL")
	if baseURL == "" {
		baseURL = "http://127.0.0.1:8090"
	}
	return config{
		addr:    addr,
		baseURL: strings.TrimRight(baseURL, "/"),
	}
}

func prometheusQuery(ctx context.Context, req mcp.CallToolRequest, args queryArgs) (*mcp.CallToolResult, error) {
	service := fallback(args.Service, "unknown-service")
	query := fallback(args.Query, "up")

	text := fmt.Sprintf(
		"service=%s query=%s result=cpu_avg=91%%, error_rate=4.8%%, p95=1.2s, traffic_change=+22%%",
		service,
		query,
	)
	return mcp.NewToolResultText(text), nil
}

func logSearch(ctx context.Context, req mcp.CallToolRequest, args logArgs) (*mcp.CallToolResult, error) {
	service := fallback(args.Service, "unknown-service")
	keyword := fallback(args.Keyword, "error")

	text := fmt.Sprintf(
		"service=%s keyword=%s hits=[timeout to inventory-service, slow query warning, retry burst observed]",
		service,
		keyword,
	)
	return mcp.NewToolResultText(text), nil
}

func mysqlQuery(ctx context.Context, req mcp.CallToolRequest, args mysqlArgs) (*mcp.CallToolResult, error) {
	service := fallback(args.Service, "unknown-service")
	statement := fallback(args.Statement, "show slow query summary")

	text := fmt.Sprintf(
		"service=%s statement=%s result=top1 SELECT payment_id FROM orders ... duration=1280ms rows=12034 count=16",
		service,
		statement,
	)
	return mcp.NewToolResultText(text), nil
}

func runbookSearch(ctx context.Context, req mcp.CallToolRequest, args runbookArgs) (*mcp.CallToolResult, error) {
	service := strings.ToLower(fallback(args.Service, "general"))
	query := strings.ToLower(fallback(args.Query, "incident"))

	corpus := map[string]string{
		"payment-service": "payment-service runbook: first inspect CPU, timeout logs, retry spikes, then check slow SQL and recent release diffs.",
		"general":         "general oncall runbook: confirm impact, inspect metrics, retrieve historical incidents, then decide mitigation and escalation.",
	}

	best := corpus["general"]
	for key, value := range corpus {
		if strings.Contains(service, key) || strings.Contains(query, key) {
			best = value
			break
		}
	}
	return mcp.NewToolResultText(best), nil
}

func fallback(value string, fallbackValue string) string {
	if strings.TrimSpace(value) == "" {
		return fallbackValue
	}
	return value
}
