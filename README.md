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

## Required Environment Variables

Set the model access variables before running the API if you want chat, ops, or indexing to work end-to-end:

```bash
export AEGISFLOW_OPENAI_API_KEY=your_key
export AEGISFLOW_OPENAI_BASE_URL=https://your-openai-compatible-endpoint/v1
export AEGISFLOW_CHAT_MODEL=gpt-4.1-mini
export AEGISFLOW_EMBEDDING_MODEL=text-embedding-3-small
```

Optional runtime variables:

```bash
export AEGISFLOW_MCP_SSE_URL=http://127.0.0.1:8090/sse
export AEGISFLOW_MILVUS_ADDR=127.0.0.1:19530
```

## Run the Services

Start the MCP server:

```bash
npm run dev:mcp
```

Start the API:

```bash
npm run dev:api
```

Start the web console:

```bash
cd apps/web
npm run generate:api
npm run dev
```

The Vite dev server listens on `0.0.0.0:5173`, so you can open it with `http://<your-ip>:5173`.
By default the web client sends API requests to `http://<current-host>:6872`.

## Main Demo Flows

1. Upload a runbook document and create a knowledge indexing job.
2. Create a chat session and run a Chat ReAct flow.
3. Create an ops session and run the supervisor workflow.
4. Approve and resume an interrupted ops run from the console.
5. Open the MCP tool catalog and inspect the discovered tool schemas.

## Notes

- The API can start without model credentials, but chat, ops, and knowledge indexing will fail until the OpenAI-compatible variables are provided.
- The MCP tools are real protocol tools served by `apps/mcp`, but their data sources still use local demo data for safe local walkthroughs.
- The repository uses the MIT license.

