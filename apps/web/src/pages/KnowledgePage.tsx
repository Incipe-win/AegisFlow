import { useState } from "react";

import {
  postKnowledgeIndex,
  uploadKnowledgeFile,
  type KnowledgeIndexResponse,
  type UploadFileResponse,
} from "../api/client";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";

export function KnowledgePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadFileResponse | null>(null);
  const [indexResult, setIndexResult] = useState<KnowledgeIndexResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) {
      setError("请先选择一个 Markdown 或文本文件。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await uploadKnowledgeFile(file);
      setUploadResult(result);
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
      const result = await postKnowledgeIndex({
        documentIds,
        chunkSize: 220,
        overlap: 40,
        topK: 3,
      });
      setIndexResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "索引失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-grid">
      <SectionCard
        title="知识文档上传"
        description="上传 Markdown 或文本文件，API 会保存文件并登记为可索引文档。"
      >
        <div className="action-row">
          <input
            type="file"
            accept=".md,.txt,.markdown"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <button type="button" onClick={handleUpload} disabled={loading}>
            {loading ? "上传中..." : "上传文件"}
          </button>
        </div>
        {file ? (
          <p className="hint-line">已选择：{file.name}</p>
        ) : (
          <p className="hint-line">建议先上传一份业务手册或故障复盘文档。</p>
        )}
        {uploadResult ? (
          <div className="result-block">
            <div className="result-header">
              <h3>上传结果</h3>
              <StatusPill tone="success">{uploadResult.data.status}</StatusPill>
            </div>
            <pre>{JSON.stringify(uploadResult, null, 2)}</pre>
            <button
              type="button"
              onClick={() => handleIndex([uploadResult.data.documentId])}
              disabled={loading}
            >
              对刚上传的文档执行索引
            </button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="知识索引"
        description="执行文档分块和检索准备。默认也会对内置的示例运行手册重新建索引。"
      >
        <div className="action-row">
          <button type="button" onClick={() => handleIndex()} disabled={loading}>
            {loading ? "处理中..." : "索引全部文档"}
          </button>
          <StatusPill>chunkSize=220 / topK=3</StatusPill>
        </div>
        {indexResult ? (
          <div className="result-block">
            <div className="result-header">
              <h3>索引结果</h3>
              <StatusPill tone="success">
                {indexResult.data.indexedChunks} chunks
              </StatusPill>
            </div>
            <pre>{JSON.stringify(indexResult, null, 2)}</pre>
          </div>
        ) : (
          <p className="hint-line">
            首次启动后建议先点一次“索引全部文档”，确保内置示例知识可以被问答和诊断模块召回。
          </p>
        )}
        {error ? <p className="error-line">{error}</p> : null}
      </SectionCard>
    </div>
  );
}

