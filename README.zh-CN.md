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

## 运行时配置

现在除了环境变量以外，API 也支持通过配置文件读取模型和运行参数。

仓库内默认配置文件：

- `apps/api/manifest/config/config.yaml`
- `apps/api/manifest/config/runtime.yaml`

本地覆盖模板：

- `apps/api/manifest/config/config.local.example.yaml`
- `apps/api/manifest/config/runtime.local.example.yaml`

推荐做法：

1. 复制 `apps/api/manifest/config/config.local.example.yaml`
2. 重命名为 `apps/api/manifest/config/config.local.yaml`
3. 按你的本机 MySQL 端口修改数据库连接
4. 复制 `apps/api/manifest/config/runtime.local.example.yaml`
5. 重命名为 `apps/api/manifest/config/runtime.local.yaml`
6. 在这个本地文件里填写模型地址和密钥
7. 环境变量只在临时覆盖或 CI 场景下使用

示例：

```bash
cp apps/api/manifest/config/config.local.example.yaml apps/api/manifest/config/config.local.yaml
cp apps/api/manifest/config/runtime.local.example.yaml apps/api/manifest/config/runtime.local.yaml
```

加载顺序：

1. GoFrame 基础配置默认读取 `manifest/config/config.yaml`
2. 如果存在 `manifest/config/config.local.yaml` 且没有显式设置 `GF_GCFG_FILE`，API 会自动优先使用它
3. 如果显式设置了 `GF_GCFG_FILE`，则以该环境变量为准，例如 Docker Compose 中的 `config.compose.yaml`
4. 运行时模型配置会继续按 `manifest/config/runtime.yaml` -> `manifest/config/runtime.local.yaml` -> 同名 `AEGISFLOW_*` 环境变量 的顺序覆盖

## 可选环境变量覆盖

如果要临时覆盖配置文件里的值，仍然可以使用环境变量：

```bash
export AEGISFLOW_OPENAI_API_KEY=your_key
export AEGISFLOW_OPENAI_BASE_URL=https://your-openai-compatible-endpoint/v1
export AEGISFLOW_CHAT_MODEL=gpt-4.1-mini
export AEGISFLOW_EMBEDDING_MODEL=text-embedding-3-small
export AEGISFLOW_MCP_SSE_URL=http://127.0.0.1:8090/sse
export AEGISFLOW_MILVUS_ADDR=127.0.0.1:19530
```

## 启动方式

现在推荐使用 Docker Compose 一键拉起整个开发环境：

```bash
docker compose up
```

或者用 npm 别名：

```bash
npm run dev
```

这会一次性启动：

- `mysql`
- `etcd`
- `minio`
- `milvus`
- `apps/mcp`
- `apps/api`
- `apps/web`

其中：

- `apps/mcp` 和 `apps/api` 在容器内通过 `air` 实现 Go 热重载
- `apps/web` 在容器内通过 Vite 实现前端热更新
- 前端容器启动时会自动重新生成 OpenAPI 类型

前端开发服务器默认监听 `0.0.0.0:5173`，可以直接通过 `http://<你的IP>:5173` 访问。
前端默认会把 API 请求发到 `http://<当前访问主机>:6872`。

停止整套环境：

```bash
npm run dev:down
```

如果你仍然想在宿主机直接跑开发服务，也保留了本机模式：

```bash
npm run dev:host
```

如果你在宿主机模式下放了 `apps/api/manifest/config/config.local.yaml`，`npm run dev:api` 会自动读取它，不需要再手动设置 `GF_GCFG_FILE`。

以及单独服务模式：

```bash
npm run dev:mcp
npm run dev:api
npm run dev:web
```

## 建议演示顺序

1. 上传一份运行手册，并创建知识索引任务。
2. 创建 Chat Session，执行一次 Chat Run。
3. 创建 Ops Session，执行一次 Supervisor 运维诊断。
4. 在控制台中批准并恢复被中断的 Ops Run。
5. 打开 MCP Tool Catalog，查看协议工具目录。

## 说明

- API 即使没有模型密钥也能启动，但 Chat、Ops 和知识索引会在真正执行时失败；请在 `runtime.local.yaml` 或环境变量里补齐模型配置。
- MCP 工具已经是真实协议工具，但其数据源目前仍然是本地演示数据，便于本地安全演示。
- 项目使用 MIT License。
