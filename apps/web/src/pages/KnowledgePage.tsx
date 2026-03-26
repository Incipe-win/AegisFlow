import { useState } from "react";

import {
  createKnowledgeIndexJob,
  uploadKnowledgeDocument,
  type KnowledgeDocument,
  type KnowledgeIndexJob,
} from "../api/client";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";

export function KnowledgePage() {
  const [file, setFile] = useState<File | null>(null);
  const [document, setDocument] = useState<KnowledgeDocument | null>(null);
  const [job, setJob] = useState<KnowledgeIndexJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) {
      setError("请先选择一个文档文件。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await uploadKnowledgeDocument(file);
      setDocument(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleIndex(documentIds?: string[]) {
    setLoading(true);
    setError(null);
    try {
      const response = await createKnowledgeIndexJob({
        documentIds,
        chunkSize: 500,
        overlap: 80,
        topK: 4,
      });
      setJob(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "索引任务创建失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-grid">
      <SectionCard
        title="知识文档上传"
        description="上传后端会写入知识文档表，后续再通过 Milvus 索引任务异步建立向量数据。"
      >
        <div className="action-row">
          <input
            type="file"
            accept=".md,.txt,.html"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button type="button" onClick={handleUpload} disabled={loading}>
            {loading ? "上传中..." : "上传知识文档"}
          </button>
        </div>
        {file ? <p className="hint-line">已选择：{file.name}</p> : null}
        {document ? (
          <div className="result-block">
            <div className="result-header">
              <h3>上传结果</h3>
              <StatusPill tone="success">{document.status}</StatusPill>
            </div>
            <pre>{JSON.stringify(document, null, 2)}</pre>
            <button
              type="button"
              onClick={() => handleIndex([document.id])}
              disabled={loading}
            >
              对当前文档创建索引任务
            </button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="知识索引任务"
        description="索引任务会把文档分块、做 embedding，并写入 Milvus collection。"
      >
        <div className="action-row">
          <button type="button" onClick={() => handleIndex()} disabled={loading}>
            {loading ? "提交中..." : "为全部知识文档创建索引任务"}
          </button>
          <StatusPill>Milvus + OpenAI Embedding</StatusPill>
        </div>
        {job ? (
          <div className="result-block">
            <div className="result-header">
              <h3>任务状态</h3>
              <StatusPill tone={job.status === "completed" ? "success" : "warning"}>
                {job.status}
              </StatusPill>
            </div>
            <pre>{JSON.stringify(job, null, 2)}</pre>
          </div>
        ) : (
          <p className="hint-line">创建索引任务后，返回的 job 对象会展示在这里。</p>
        )}
        {error ? <p className="error-line">{error}</p> : null}
      </SectionCard>
    </div>
  );
}

