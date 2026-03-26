# AegisFlow

English | [简体中文](./README.zh-CN.md)

AegisFlow is a front-end/back-end separated intelligent OnCall platform for resume demos and local product walkthroughs. The project combines a GoFrame API service, a React console, OpenAPI-first contracts, a DAO-style data layer, a lightweight RAG pipeline, and mock AIOps tools that can later be replaced with MCP or real infrastructure providers.

## Architecture

- `apps/api`: GoFrame API service with DAO-style repositories, knowledge indexing, chat, and ops diagnosis.
- `apps/web`: React + Vite console driven by OpenAPI-generated TypeScript types.
- `openapi/openapi.yaml`: the only API contract source of truth.
- `docs/接口文档.md`: human-readable API guide derived from OpenAPI.
- `README.zh-CN.md`: simplified Chinese project guide.
- `LICENSE`: open source license for reuse and distribution.

## Core Flows

- Knowledge indexing: upload Markdown or text files, split them into chunks, score them, and store them for retrieval.
- Chat agent: multi-turn Q&A with context memory, knowledge retrieval, and SSE streaming output.
- Ops diagnosis: ingest alert context, retrieve runbooks, call mock tools, and produce diagnosis suggestions with a full execution trail.

## Local Development

### 1. Install dependencies

```bash
cd apps/api && go mod tidy
cd ../web && npm install
```

### 2. Start infrastructure

```bash
docker compose up -d mysql
```

The bundled MySQL container is exposed on `127.0.0.1:3307` to avoid conflicts with an existing local MySQL instance.

### 3. Run the API

```bash
cd apps/api
go run .
```

The API defaults to `http://localhost:6872`.

### 4. Generate web API types and start the console

```bash
cd apps/web
npm run generate:api
npm run dev
```

The web console defaults to `http://localhost:5173`.

## Notes

- The MVP keeps the AI workflow deterministic so the demo runs locally without external model keys.
- Tooling interfaces are already separated so the current mock providers can be replaced by Eino-based model flows and MCP tools later.
- The uploaded documents and runtime records are stored in MySQL; chunk scoring uses a lightweight built-in tokenizer suitable for a demo environment.
- The repository uses the MIT license.

## Git Hygiene

- Do not commit `node_modules`, local uploads, front-end build artifacts, TypeScript build info files, or editor-specific settings.
- Regenerate web API types with `npm --workspace apps/web run generate:api` after changing `openapi/openapi.yaml`.
