import createClient from "openapi-fetch";

import type { components, paths } from "./generated";

export type Session = components["schemas"]["Session"];
export type Run = components["schemas"]["Run"];
export type RunEvent = components["schemas"]["RunEvent"];
export type KnowledgeDocument = components["schemas"]["KnowledgeDocument"];
export type KnowledgeIndexJob = components["schemas"]["KnowledgeIndexJob"];
export type MCPToolDescriptor = components["schemas"]["MCPToolDescriptor"];
export type CreateSessionRequest = components["schemas"]["CreateSessionRequest"];
export type ChatRunRequest = components["schemas"]["ChatRunRequest"];
export type OpsRunRequest = components["schemas"]["OpsRunRequest"];
export type ResumeRunRequest = components["schemas"]["ResumeRunRequest"];
export type CreateKnowledgeIndexJobRequest =
  components["schemas"]["CreateKnowledgeIndexJobRequest"];

function getDefaultApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBaseUrl) return envBaseUrl;

  if (typeof window === "undefined") return "";

  const port = window.location.port;
  // In dev (Vite :5173), proxy /api to backend. In prod, nginx proxies same-origin.
  if (!port || port === "80" || port === "443" || port === "5173") return "";

  // Keep port 6872 only for when accessing API directly (legacy / direct-connect)
  return `${window.location.protocol}//${window.location.hostname}:6872`;
}

export const apiBaseUrl = getDefaultApiBaseUrl();

export const apiClient = createClient<paths>({
  baseUrl: apiBaseUrl,
});

function extractApiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if ("error" in error && typeof error.error === "string" && error.error.trim()) {
    return error.error.trim();
  }
  if ("message" in error && typeof error.message === "string" && error.message.trim() && error.message !== "ERROR") {
    return error.message.trim();
  }
  if ("data" in error) {
    return extractApiErrorMessage(error.data);
  }

  return null;
}

async function ensureData<T>(promise: Promise<{ data?: T; error?: unknown }>, message: string) {
  const { data, error } = await promise;
  if (error || !data) {
    const detail = extractApiErrorMessage(error);
    throw new Error(detail ? `${message}: ${detail}` : message);
  }
  return data;
}

export function createSession(body: CreateSessionRequest) {
  return ensureData(
    apiClient.POST("/api/v2/sessions", { body }),
    "创建会话失败",
  );
}

export function runChat(body: ChatRunRequest) {
  return ensureData(
    apiClient.POST("/api/v2/runs/chat", { body }),
    "聊天运行失败",
  );
}

export function runOps(body: OpsRunRequest) {
  return ensureData(
    apiClient.POST("/api/v2/runs/ops", { body }),
    "运维运行失败",
  );
}

export function getRun(runId: string) {
  return ensureData(
    apiClient.GET("/api/v2/runs/{runId}", {
      params: { path: { runId } },
    }),
    "查询运行详情失败",
  );
}

export function listRunEvents(runId: string) {
  return ensureData(
    apiClient.GET("/api/v2/runs/{runId}/events", {
      params: { path: { runId } },
    }),
    "查询事件列表失败",
  );
}

export function resumeRun(runId: string, body: ResumeRunRequest) {
  return ensureData(
    apiClient.POST("/api/v2/runs/{runId}/resume", {
      params: { path: { runId } },
      body,
    }),
    "恢复运行失败",
  );
}

export function createKnowledgeIndexJob(body: CreateKnowledgeIndexJobRequest) {
  return ensureData(
    apiClient.POST("/api/v2/knowledge/index-jobs", { body }),
    "创建知识索引任务失败",
  );
}

export function listMCPTools() {
  return ensureData(
    apiClient.GET("/api/v2/tools/mcp"),
    "查询 MCP 工具目录失败",
  );
}

export async function uploadKnowledgeDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${apiBaseUrl}/api/v2/knowledge/documents`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error("上传知识文档失败");
  }
  return (await response.json()) as {
    message: string;
    data: KnowledgeDocument;
  };
}
