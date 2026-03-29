# AegisFlow

[English](./README.md) | [简体中文](./README.zh-CN.md)

**AegisFlow** 是一个以 Go 语言为主导的智能化 OnCall 与系统可靠性工程（SRE）平台。它利用大型语言模型和现代智能体（Agent）编排技术，实现故障响应的自动化、简化运维流程并大幅提升工程效率。

本项目基于强大的技术栈构建，深度融合了 `GoFrame`、`Eino`、`Milvus` 以及 `Model Context Protocol (MCP)`，并完整落地了 RAG（检索增强生成）、ReAct 工作流、Plan-Execute-Replan（计划-执行-重计划）循环和多智能体监督协调（Multi-Agent Supervisor）等前沿 AI 技术范式。

---

## 核心功能

- **智能运维对话**：通过基于 ReAct 的原生对话智能体，利用 MCP 协议实时调用实际工具，与您的基础设施进行自然交互。
- **自动化运维工作流 (Plan-Execute)**：利用 `adk/prebuilt/planexecute` 执行自动化的诊断工作流，以解决复杂的运维难题。
- **多智能体协同 (Multi-Agent Supervisor)**：通过监督者智能体（Supervisor）协调多个专家智能体，分别完成运行手册解读、工具执行和状态报告。
- **强大的 RAG 知识库**：支持上传并索引 SRE 运行手册，结合兼容 OpenAI 的嵌入模型和 Milvus 向量库，实现精准的故障上下文检索。
- **人机协同 (Human-in-the-Loop)**：对于敏感或高风险的运维操作，支持在 React 控制台中中断任务，执行人工审核与批准后再继续运行。
- **基于 MCP 的极简扩展**：通过独立的 Model Context Protocol Server (基于 SSE 流) ，无缝接入和集成现有基础设施和脚本工具。

## 架构设计

AegisFlow 采用了微服务化、职责分离的现代架构设计：

- **`apps/api`**：基于 GoFrame 构建的核心 API 服务。负责会话管理、事件生命周期、DAO 层数据持久化、SSE 流式输出，并通过 Eino 框架进行深度的智能体编排。
- **`apps/mcp`**：基于 `mark3labs/mcp-go` 开发的独立 Go MCP 服务器。遵循 MCP 协议，通过 Server-Sent Events (SSE) 暴露运维工具。
- **`apps/web`**：现代化的 React + Vite 前端控制台。提供直观的用户界面，用于管理对话、运维运行记录、人工审批流、事件时间线以及直观的 MCP 工具目录。
- **`openapi`**：采用契约优先（Contract-first）的设计理念，维护 `/api/v2` 接口规范，保障前后端通信的一致性。

## 技术栈

- **后端**：Go Application Framework (GoFrame), Eino (智能体编排)
- **前端**：React, TypeScript, Vite, Tailwind CSS
- **向量数据库**：Milvus (支撑 RAG)
- **关系型数据库**：MySQL 
- **对象存储**：MinIO 
- **AI / Agent**：OpenAI 模型接入, ReAct 模型, Multi-Agent Supervisor, Model Context Protocol (MCP)

## 快速开始

### 环境依赖

在运行项目之前，请确保您的系统已安装 [Docker](https://www.docker.com/) 和 [Docker Compose](https://docs.docker.com/compose/)。同时需要本机安装 Node.js 与 npm，用于运行前端的包管理和启动脚本。

### 1. 启动基础依赖

一键拉起 MySQL, etcd, MinIO 和 Milvus 数据库容器：

```bash
docker compose up -d mysql etcd minio milvus
```

*主要组件端口映射：*
- **MySQL**: `127.0.0.1:3307`
- **Milvus**: `127.0.0.1:19530`
- **MinIO API/Console**: `127.0.0.1:9000` / `127.0.0.1:9001`

### 2. 配置环境变量

除了传统的环境变量，AegisFlow 的 API 现支持通过本地配置文件灵活管理模型密钥和运行时参数。

1. **复制配置模板：**
   ```bash
   cp apps/api/manifest/config/config.local.example.yaml apps/api/manifest/config/config.local.yaml
   cp apps/api/manifest/config/runtime.local.example.yaml apps/api/manifest/config/runtime.local.yaml
   ```
2. **配置 AI 模型信息：** 打开 `apps/api/manifest/config/runtime.local.yaml`，填入您的 OpenAI-compatible 接口地址和 API Key。
3. *可选：* 如果您的本地 MySQL 运行端口不同，可修改 `config.local.yaml` 中的数据库连接信息。

*注：在 CI 场景或需要临时调试时，您仍可以使用 `AEGISFLOW_OPENAI_API_KEY` 等环境变量直接覆盖上述文件配置。*

### 3. 运行项目服务

建议使用 Docker Compose 完整拉起开发环境（包含所有后端与前端服务）：

```bash
npm run dev
# 或执行: docker compose up
```

该命令将并行启动所有依赖服务和 `mcp`, `api`, `web` 容器：
- Go 后端 (`mcp` 和 `api`) 已在容器内配置 `air`，支持保存即实现热重载。
- Node 前端 (`web`) 通过 Vite 提供 HMR（热更新），项目启动后请在浏览器访问 `http://localhost:5173`。

如需停止开发环境：

```bash
npm run dev:down
```

*(如需在宿主机原生运行服务，亦可执行 `npm run dev:host`。单独启动组件可参考命令 `npm run dev:api`, `npm run dev:web` 等。)*

## 推荐演示流程

为了全面体验 AegisFlow，建议按照以下步骤进行操作：

1. **知识入库**：上传一份运维 SOP 或运行手册文档，并在系统中创建知识索引任务。
2. **交互式排查**：创建一个 Chat Session，通过对话形式向 ReAct Agent 询问基础设施状态。
3. **自动化运维**：创建一个 Ops Session，触发底层的 Supervisor 运维诊断工作流。
4. **人工审批流**：在执行高危操作时，Agent 会挂起任务请求人工干预，请在控制台中点击批准以恢复 (Resume) 被中断的 Ops Run。
5. **工具探索**：进入 MCP Tool Catalog 页面，查看通过独立外置 MCP 服务获取并注册的工具目录。

## 许可证

本项目基于 MIT License 协议开源。
