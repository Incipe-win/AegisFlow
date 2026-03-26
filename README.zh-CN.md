# AegisFlow

[English](./README.md) | 简体中文

AegisFlow 是一个面向简历展示和本地演示的智能运维 / OnCall 平台。项目采用前后端分离架构，整合 GoFrame API 服务、React 控制台、OpenAPI 契约、DAO 风格数据层、轻量 RAG 检索链路，以及可替换为 MCP 或真实基础设施的 mock AIOps 工具。

## 项目结构

- `apps/api`：GoFrame 后端服务，包含 DAO 风格仓储、知识索引、智能问答和运维诊断。
- `apps/web`：React + Vite 前端控制台，使用 OpenAPI 生成的 TypeScript 类型进行联调。
- `openapi/openapi.yaml`：唯一的接口契约源。
- `docs/接口文档.md`：基于 OpenAPI 整理的人类可读接口文档。
- `LICENSE`：开源许可证。

## 核心能力

- 知识库索引：上传 Markdown 或文本文件，执行文档分块并建立可检索内容。
- 智能问答：支持多轮上下文、知识检索增强和 SSE 流式输出。
- AI 运维诊断：输入告警信息后，自动完成知识检索、工具调用、分析归纳和建议生成。

## 本地开发

### 1. 安装依赖

```bash
cd apps/api
go mod tidy

cd ../web
npm install
```

### 2. 启动基础设施

```bash
docker compose up -d mysql
```

内置 MySQL 容器暴露在 `127.0.0.1:3307`，避免与本机已有的 `3306` 冲突。

### 3. 启动后端

```bash
cd apps/api
go run .
```

后端默认监听 `http://localhost:6872`。

### 4. 生成前端接口类型并启动控制台

```bash
cd apps/web
npm run generate:api
npm run dev
```

前端默认运行在 `http://localhost:5173`。

## 建议演示顺序

1. 先执行知识索引，确保内置样例文档可以被召回。
2. 进入智能问答页面，展示多轮问答和 SSE 流式返回。
3. 进入 AI 运维页面，输入告警信息并展示工具调用轨迹和诊断建议。

## 开发说明

- 当前 MVP 采用确定性的 mock Agent 逻辑，因此不依赖外部大模型密钥也可以完成本地演示。
- 如果修改了 `openapi/openapi.yaml`，请重新执行 `npm --workspace apps/web run generate:api`。
- `node_modules`、本地上传文件、前端构建产物、TypeScript 构建缓存和编辑器配置不应提交到 Git。

## 开源协议

本项目使用 MIT License。
