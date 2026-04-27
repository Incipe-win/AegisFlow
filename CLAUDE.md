# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AegisFlow is an intelligent Go-first OnCall and SRE platform leveraging LLMs for incident response. Built on GoFrame + Eino (agent orchestration) + Milvus (vector DB) + MCP (Model Context Protocol).

## Commands

```bash
# Start all infrastructure dependencies (MySQL, etcd, MinIO, Milvus)
npm run dev:infra

# Full dev stack via Docker Compose (infra + mcp + api + web with hot reload)
npm run dev

# Host-native dev (infra in Docker, Go/Node services on host)
npm run dev:host

# Individual services
npm run dev:mcp      # MCP server with air hot reload (port 8090)
npm run dev:api      # API server with air hot reload (port 6872)
npm run dev:web      # React frontend Vite HMR (port 5173)

# Generate TypeScript API client from OpenAPI spec
npm run generate:api

# Frontend type-check + build
npm run build:web

# Stop dev stack
npm run dev:down
```

**Setup**: Before first run, copy `apps/api/manifest/config/config.local.example.yaml` → `config.local.yaml` and `runtime.local.example.yaml` → `runtime.local.yaml`. Set your OpenAI-compatible endpoint/API key in `runtime.local.yaml`. For Docker Compose mode, env vars `AEGISFLOW_OPENAI_API_KEY` etc. are passed through.

No dedicated test framework is configured — the project is functional/demo focused.

## Architecture

```
apps/api/          GoFrame API server (Go 1.25)
  internal/
    agent/         Legacy v1 agents (ChatAgent, OpsAgent, Retriever) — rule-based, no LLM
    controller/    HTTP handlers: api.go (v1 /api/v1), platform.go (v2 /api/v2)
    model/         Data types: types.go (v1), platform_types.go (v2 with Eino run model)
    platform/      V2 service layer — session/run lifecycle, knowledge indexing async worker
    repository/    DAO-style MySQL access (GoFrame ORM): repository.go (v1), platform.go (v2)
    runtime/       Eino agent wiring: ChatModel, MCP tools, Milvus embedder/indexer,
                   checkpoint store, approval tool (human-in-the-loop), agent runners
    service/       V1 service layer (App struct)
    store/         MySQL schema bootstrap + seed data
    tool/          Mock tool provider for v1 Diagnose
  manifest/config/ YAML configs: GoFrame server + runtime (AI model, Milvus, MCP URLs)

apps/mcp/          Standalone Go MCP server (SSE on :8090)
                   Registers 4 mock tools: prometheus.query, logs.search, mysql.query, runbook.search

apps/web/          React 18 + Vite + TypeScript + Tailwind CSS
  src/api/         OpenAPI-generated typed client (openapi-fetch) + SSE streaming
  src/pages/       UnifiedWorkspacePage, ChatPage, OpsPage, KnowledgePage, ToolsPage
  src/components/  ChatMessage, ChatHistory, MessageInput, SectionCard, StatusPill,
                   KnowledgePanel, OpsPanel, ToolsPanel, Shell, WorkspaceShell
  src/hooks/       useChatSession

openapi/           openapi.yaml — contract-first API spec (v2), drives TypeScript client gen
```

## Key Architectural Patterns

**Dual API surface**: `/api/v1` (legacy) uses rule-based agents (`internal/agent/`, `internal/service/`). `/api/v2` (platform) uses Eino-based real LLM agents (`internal/platform/`, `internal/runtime/`). The v2 path is the active development target.

**Agent orchestration (v2)**: `runtime/agents.go` wires Eino agents:
- `NewChatRunner`: single ReAct agent with MCP tools
- `NewOpsRunner`: supervisor → 3 sub-agents (RunbookRetrieverAgent, Plan-Execute-Replan, ReporterAgent) with approval tool for human-in-the-loop
- All runs use checkpointing (`runtime/checkpoint_store.go`) for interrupt/resume

**Configuration**: Merged from `manifest/config/runtime.yaml` → `runtime.local.yaml` → env vars. The `runtime.Config` struct (`runtime/config.go`) centralizes all settings. GoFrame config (`config.yaml`) handles server/database independently.

**Knowledge retrieval with fallback**: Primary path uses Milvus vector search. On any error (connection refused, timeout, no results), falls back to local MySQL-based token matching in `RetrieveReferences`.

**MCP integration**: The API connects to the MCP server via SSE. `runtime/deps.go` creates an MCP client, lists tools, and wraps selected tools as Eino-compatible tools for agent use.

**OpenAPI contract-first**: `openapi/openapi.yaml` is the source of truth for v2 API. Run `npm run generate:api` to regenerate `apps/web/src/api/generated.ts` after changing the spec. The generated client is used by `apps/web/src/api/client.ts`.

**Schema management**: Two parallel table sets — v1 tables (documents, document_chunks, chat_messages, agent_runs) in `store/bootstrap.go`, v2 tables (agent_sessions, agent_runs_v2, agent_run_events, knowledge_documents, knowledge_index_jobs, agent_checkpoints) in `store/platform_bootstrap.go`. Both auto-create on startup.
