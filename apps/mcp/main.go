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
	return mcp.NewToolResultText(fmt.Sprintf("prometheus.query is not yet implemented (service=%s query=%s)", args.Service, args.Query)), nil
}

func logSearch(ctx context.Context, req mcp.CallToolRequest, args logArgs) (*mcp.CallToolResult, error) {
	return mcp.NewToolResultText(fmt.Sprintf("logs.search is not yet implemented (service=%s keyword=%s)", args.Service, args.Keyword)), nil
}

func mysqlQuery(ctx context.Context, req mcp.CallToolRequest, args mysqlArgs) (*mcp.CallToolResult, error) {
	return mcp.NewToolResultText(fmt.Sprintf("mysql.query is not yet implemented (service=%s)", args.Service)), nil
}

func runbookSearch(ctx context.Context, req mcp.CallToolRequest, args runbookArgs) (*mcp.CallToolResult, error) {
	return mcp.NewToolResultText(fmt.Sprintf("runbook.search is not yet implemented (service=%s query=%s)", args.Service, args.Query)), nil
}
