# AegisFlow

[English](./README.md) | [简体中文](./README.zh-CN.md)

**AegisFlow** is an intelligent, Go-first OnCall and Site Reliability Engineering (SRE) platform. It leverages large language models and modern agent orchestration to automate incident response, streamline operations, and enhance engineering productivity.

Built on a robust technology stack featuring `GoFrame`, `Eino`, `Milvus`, and the `Model Context Protocol (MCP)`, AegisFlow implements advanced AI paradigms including RAG (Retrieval-Augmented Generation), ReAct workflows, Plan-Execute-Replan cycles, and Multi-Agent Supervisor coordination.

---

## Key Features

- **Intelligent Chat Operations**: Interact with your infrastructure through a ReAct-powered chat agent capable of real tool invocation via MCP.
- **Automated Ops Workflows (Plan-Execute)**: Autonomous diagnostic workflows utilizing the `adk/prebuilt/planexecute` to solve complex operational issues.
- **Multi-Agent Supervisor**: Coordinate multiple specialized agents for runbook interpretation, execution, and reporting.
- **RAG-Powered Knowledge Base**: Upload and index SRE runbooks using OpenAI-compatible embeddings and Milvus for accurate context retrieval.
- **Human-in-the-Loop**: Pause, review, and approve critical operational runs via the React-based console before execution.
- **Extensible Tooling with MCP**: Seamless integration with existing tools using a standalone Model Context Protocol (MCP) server over SSE.

## Architecture

AegisFlow adopts a decoupled, microservice-inspired architecture:

- **`apps/api`**: The core API service built with GoFrame. Handles session and event management, DAO-style database interactions, SSE streaming, and orchestrates agents using Eino.
- **`apps/mcp`**: A standalone Go MCP server (built with `mark3labs/mcp-go`) that exposes real operational tools via Server-Sent Events (SSE).
- **`apps/web`**: A modern React + Vite frontend console providing an intuitive interface for chatting, operational run management, approval flows, event timelines, and MCP tool cataloging.
- **`openapi`**: Contract-first API definitions (`/api/v2`) ensuring consistency between backend and frontend.

## Tech Stack

- **Backend**: Go Application Framework (GoFrame), Eino (Agent Orchestration)
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Vector Database**: Milvus (for RAG)
- **Relational Database**: MySQL
- **Storage**: MinIO
- **AI/Agents**: OpenAI Connectors, ReAct, Multi-Agent Supervisor, Model Context Protocol (MCP)

## Getting Started

### Prerequisites

Ensure you have [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed on your system. Node.js and npm are required for frontend package management and start scripts.

### 1. Start Infrastructure Dependencies

Bring up MySQL, etcd, MinIO, and Milvus:

```bash
docker compose up -d mysql etcd minio milvus
```

*Port Bindings:*
- **MySQL**: `127.0.0.1:3307`
- **Milvus**: `127.0.0.1:19530`
- **MinIO API/Console**: `127.0.0.1:9000` / `127.0.0.1:9001`

### 2. Configure the Environment

AegisFlow supports both file-based configurations and environment variable overrides.

1. **Copy configuration templates:**
   ```bash
   cp apps/api/manifest/config/config.local.example.yaml apps/api/manifest/config/config.local.yaml
   cp apps/api/manifest/config/runtime.local.example.yaml apps/api/manifest/config/runtime.local.yaml
   ```
2. **Setup AI Models:** Edit `apps/api/manifest/config/runtime.local.yaml` and provide your OpenAI-compatible endpoint and API keys.
3. *Optional:* Adjust the database DSN in `config.local.yaml` if your MySQL port differs.

*Note: Environment variables (e.g., `AEGISFLOW_OPENAI_API_KEY`) can still be used for temporary overrides or in CI environments.*

### 3. Run the Application

The recommended method to start the entire development environment is via Docker Compose:

```bash
npm run dev
# or: docker compose up
```

This command will start the infrastructure services alongside the `mcp`, `api`, and `web` containers. 
- The Go backend (`mcp` and `api`) utilizes `air` for hot-reloading.
- The React frontend uses Vite for HMR (Hot Module Replacement) and is accessible at `http://localhost:5173`.

To stop the development stack:

```bash
npm run dev:down
```

*(For running services natively on your host machine, you can use `npm run dev:host`, or start individual services with `npm run dev:api`, `npm run dev:web`, etc.)*

## Demo Workflow

To experience AegisFlow's capabilities, follow this recommended sequence:

1. **Knowledge Indexing**: Upload a mock runbook or documentation and trigger a knowledge indexing job.
2. **Interactive Chat**: Create a Chat Session and ask infrastructure-related questions using the ReAct agent.
3. **Automated Ops**: Start an Ops Session to run the supervisor diagnostic workflow.
4. **Approval Flow**: Trigger a task that requires human intervention, and approve/resume it from the console.
5. **Tool Discovery**: Navigate to the MCP Tool Catalog to inspect the available tools dynamically discovered via the protocol.

## License

This project is licensed under the MIT License.
