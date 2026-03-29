# AegisFlow

English | [简体中文](./README.zh-CN.md)

AegisFlow is a Go-first intelligent OnCall platform that now uses the real stack behind the project narrative: `GoFrame`, `Eino`, `Milvus-based RAG`, `ReAct`, `Plan-Execute-Replan`, `Multi-Agent`, and `MCP`.

## Architecture

- `apps/api`: GoFrame API service, DAO-style persistence, run/session/event APIs, SSE streaming, and Eino agent orchestration.
- `apps/mcp`: standalone Go MCP server built with `mark3labs/mcp-go`, exposing real protocol tools over SSE.
- `apps/web`: React + Vite console for session creation, chat runs, ops runs, resume flow, event timelines, and MCP tool catalog.
- `openapi/openapi.yaml`: the `/api/v2` contract-first API definition.

## Real Stack Coverage

- `GoFrame`: HTTP server, routing, config, and MySQL DAO access.
- `Eino`: ADK runner, chat agents, supervisor orchestration, and plan-execute-replan workflow.
- `RAG`: OpenAI-compatible embeddings + Milvus indexer/retriever.
- `ReAct`: chat agent with real tool calling through MCP tools.
- `Plan-Executor`: ops diagnosis workflow using `adk/prebuilt/planexecute`.
- `Multi-Agent`: ops supervisor coordinating runbook, execution, and reporting specialists.
- `MCP`: standalone SSE MCP server plus Eino MCP tool wrapper on the API side.

## Local Dependencies

Start MySQL and Milvus:

```bash
docker compose up -d mysql etcd minio milvus
```

Ports:

- MySQL: `127.0.0.1:3307`
- Milvus: `127.0.0.1:19530`
- MinIO API: `127.0.0.1:9000`
- MinIO Console: `127.0.0.1:9001`

## Runtime Configuration

The API now supports file-based runtime configuration in addition to environment variables.

Tracked default config:

- `apps/api/manifest/config/config.yaml`
- `apps/api/manifest/config/runtime.yaml`

Local override template:

- `apps/api/manifest/config/config.local.example.yaml`
- `apps/api/manifest/config/runtime.local.example.yaml`

Recommended setup:

1. Copy `apps/api/manifest/config/config.local.example.yaml` to `apps/api/manifest/config/config.local.yaml`
2. Adjust the database DSN for your local MySQL port if needed
3. Copy `apps/api/manifest/config/runtime.local.example.yaml` to `apps/api/manifest/config/runtime.local.yaml`
4. Fill in your OpenAI-compatible endpoint and key
5. Keep using environment variables only when you want to override the file locally or in CI

Example:

```bash
cp apps/api/manifest/config/config.local.example.yaml apps/api/manifest/config/config.local.yaml
cp apps/api/manifest/config/runtime.local.example.yaml apps/api/manifest/config/runtime.local.yaml
```

The loader reads:

1. GoFrame base config defaults to `manifest/config/config.yaml`
2. If `manifest/config/config.local.yaml` exists and `GF_GCFG_FILE` is not set, the API automatically prefers it
3. If `GF_GCFG_FILE` is explicitly set, that value still wins, for example Docker Compose uses `config.compose.yaml`
4. Runtime model config then applies overrides in this order: `manifest/config/runtime.yaml` -> `manifest/config/runtime.local.yaml` -> environment variables with the same `AEGISFLOW_*` names

## Optional Environment Overrides

You can still override file config with environment variables:

```bash
export AEGISFLOW_OPENAI_API_KEY=your_key
export AEGISFLOW_OPENAI_BASE_URL=https://your-openai-compatible-endpoint/v1
export AEGISFLOW_CHAT_MODEL=gpt-4.1-mini
export AEGISFLOW_EMBEDDING_MODEL=text-embedding-3-small
export AEGISFLOW_MCP_SSE_URL=http://127.0.0.1:8090/sse
export AEGISFLOW_MILVUS_ADDR=127.0.0.1:19530
```

## Run the Services

The recommended development entrypoint is now Docker Compose:

```bash
docker compose up
```

Or through the npm alias:

```bash
npm run dev
```

This brings up the whole stack in one shot:

- `mysql`
- `etcd`
- `minio`
- `milvus`
- `apps/mcp`
- `apps/api`
- `apps/web`

Inside the containers:

- `apps/mcp` and `apps/api` use `air` for Go hot reload
- `apps/web` uses Vite for frontend hot refresh
- the web container regenerates OpenAPI types before starting

The Vite dev server listens on `0.0.0.0:5173`, so you can open it with `http://<your-ip>:5173`.
By default the web client sends API requests to `http://<current-host>:6872`.

To stop the stack:

```bash
npm run dev:down
```

If you still want to run the services directly on the host machine, the host-mode workflow is still available:

```bash
npm run dev:host
```

When you keep `apps/api/manifest/config/config.local.yaml` in place for host mode, `npm run dev:api` picks it up automatically without needing a manual `GF_GCFG_FILE=...` prefix.

You can also run individual services:

```bash
npm run dev:mcp
npm run dev:api
npm run dev:web
```

## Main Demo Flows

1. Upload a runbook document and create a knowledge indexing job.
2. Create a chat session and run a Chat ReAct flow.
3. Create an ops session and run the supervisor workflow.
4. Approve and resume an interrupted ops run from the console.
5. Open the MCP tool catalog and inspect the discovered tool schemas.

## Notes

- The API can start without model credentials, but chat, ops, and knowledge indexing will fail until the OpenAI-compatible settings are present in `runtime.local.yaml` or environment variables.
- The MCP tools are real protocol tools served by `apps/mcp`, but their data sources still use local demo data for safe local walkthroughs.
- The repository uses the MIT license.
