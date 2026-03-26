import createClient from "openapi-fetch";

import type { components, paths } from "./generated";

export type ChatRequest = components["schemas"]["ChatRequest"];
export type ChatResponse = components["schemas"]["ChatResponse"];
export type DiagnoseRequest = components["schemas"]["DiagnoseRequest"];
export type DiagnoseResponse = components["schemas"]["DiagnoseResponse"];
export type KnowledgeIndexRequest = components["schemas"]["KnowledgeIndexRequest"];
export type KnowledgeIndexResponse = components["schemas"]["KnowledgeIndexResponse"];
export type UploadFileResponse = components["schemas"]["UploadFileResponse"];
export type RunDetailResponse = components["schemas"]["RunDetailResponse"];
export type Reference = components["schemas"]["Reference"];
export type ToolCallRecord = components["schemas"]["ToolCallRecord"];

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:6872";

export const apiClient = createClient<paths>({
  baseUrl: apiBaseUrl,
});

export async function postChat(body: ChatRequest) {
  const { data, error } = await apiClient.POST("/api/v1/chat", { body });
  if (error || !data) {
    throw new Error("智能问答请求失败");
  }
  return data;
}

export async function postDiagnose(body: DiagnoseRequest) {
  const { data, error } = await apiClient.POST("/api/v1/ops/diagnose", { body });
  if (error || !data) {
    throw new Error("诊断请求失败");
  }
  return data;
}

export async function postKnowledgeIndex(body: KnowledgeIndexRequest) {
  const { data, error } = await apiClient.POST("/api/v1/knowledge/index", {
    body,
  });
  if (error || !data) {
    throw new Error("知识索引请求失败");
  }
  return data;
}

export async function getRunDetail(runId: string) {
  const { data, error } = await apiClient.GET("/api/v1/runs/{runId}", {
    params: {
      path: {
        runId,
      },
    },
  });
  if (error || !data) {
    throw new Error("运行详情查询失败");
  }
  return data;
}

export async function uploadKnowledgeFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${apiBaseUrl}/api/v1/knowledge/files`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error("文件上传失败");
  }
  return (await response.json()) as UploadFileResponse;
}

