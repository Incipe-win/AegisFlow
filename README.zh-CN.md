# AegisFlow

[English](./README.md) | 简体中文

AegisFlow 现在已经从原来的演示型 mock OnCall 项目升级为真实技术栈版本，主链路实际使用了 `GoFrame`、`Eino`、`Milvus RAG`、`ReAct`、`Plan-Execute-Replan`、`Multi-Agent` 和 `MCP`。

## 项目结构

- `apps/api`：GoFrame 后端服务，负责 session/run/event API、DAO 持久化、SSE 流式输出，以及 Eino Agent 编排。
- `apps/mcp`：使用 `mark3labs/mcp-go` 构建的独立 Go MCP Server，通过 SSE 暴露工具。
- `apps/web`：React + Vite 控制台，展示 Chat Run、Ops Run、Resume、事件时间线和 MCP 工具目录。
- `openapi/openapi.yaml`：新的 `/api/v2` OpenAPI 契约。

## 真实技术栈覆盖

- `GoFrame`：承载 HTTP 服务、路由、配置和 MySQL DAO。
- `Eino`：承载 ADK Runner、Chat Agent、Supervisor 和 PlanExecute 编排。
- `RAG`：使用 OpenAI-compatible embedding + Milvus 建立真实检索链路。
- `ReAct`：聊天链路通过真实工具调用完成问答。
- `Plan-Executor`：运维链路使用 `adk/prebuilt/planexecute`。
- `Multi-Agent`：运维链路使用 Supervisor 协调多个子 Agent。
- `MCP`：工具由独立 MCP 服务提供，API 侧通过 Eino MCP wrapper 消费。

## 本地依赖

启动 MySQL 和 Milvus：

```bash
docker compose up -d mysql etcd minio milvus
```

端口说明：

- MySQL：`127.0.0.1:3307`
- Milvus：`127.0.0.1:19530`
- MinIO API：`127.0.0.1:9000`
- MinIO Console：`127.0.0.1:9001`

## 必需环境变量

如果要真正跑通聊天、运维和知识索引，请先配置 OpenAI-compatible 模型参数：

```bash
export AEGISFLOW_OPENAI_API_KEY=your_key
export AEGISFLOW_OPENAI_BASE_URL=https://your-openai-compatible-endpoint/v1
export AEGISFLOW_CHAT_MODEL=gpt-4.1-mini
export AEGISFLOW_EMBEDDING_MODEL=text-embedding-3-small
```

可选环境变量：

```bash
export AEGISFLOW_MCP_SSE_URL=http://127.0.0.1:8090/sse
export AEGISFLOW_MILVUS_ADDR=127.0.0.1:19530
```

## 启动方式

启动 MCP Server：

```bash
npm run dev:mcp
```

启动 API：

```bash
npm run dev:api
```

启动前端：

```bash
cd apps/web
npm run generate:api
npm run dev
```

前端开发服务器默认监听 `0.0.0.0:5173`，可以直接通过 `http://<你的IP>:5173` 访问。
前端默认会把 API 请求发到 `http://<当前访问主机>:6872`。

## 建议演示顺序

1. 上传一份运行手册，并创建知识索引任务。
2. 创建 Chat Session，执行一次 Chat Run。
3. 创建 Ops Session，执行一次 Supervisor 运维诊断。
4. 在控制台中批准并恢复被中断的 Ops Run。
5. 打开 MCP Tool Catalog，查看协议工具目录。

## 说明

- API 即使没有模型密钥也能启动，但 Chat、Ops 和知识索引会在真正执行时失败。
- MCP 工具已经是真实协议工具，但其数据源目前仍然是本地演示数据，便于本地安全演示。
- 项目使用 MIT License。

