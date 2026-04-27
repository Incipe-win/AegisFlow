import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { Upload, FileText } from "lucide-react";
import { createKnowledgeIndexJob, uploadKnowledgeDocument } from "../api/client";

interface KnowledgePanelProps {
  onClose: () => void;
}

export function KnowledgePanel({ onClose }: KnowledgePanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleUpload = async () => {
    if (files.length === 0) { setMessage("请先选择文件"); return; }
    setUploading(true);
    setMessage(null);
    setUploadProgress(0);
    try {
      for (let i = 0; i < files.length; i++) {
        setMessage(`正在上传: ${files[i].name}`);
        await uploadKnowledgeDocument(files[i]);
        setUploadProgress(((i + 1) / files.length) * 100);
      }
      setMessage(`成功上传 ${files.length} 个文件`);
      setFiles([]);
    } catch (err) {
      setMessage(`上传失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateIndex = async () => {
    setIndexing(true);
    setMessage("正在创建知识索引...");
    try {
      await createKnowledgeIndexJob({ chunkSize: 500, overlap: 80, topK: 4 });
      setMessage("知识索引任务已创建");
    } catch (err) {
      setMessage(`创建索引失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setIndexing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h4>知识库管理</h4>
        <button type="button" className="panel-close" onClick={onClose} aria-label="关闭">×</button>
      </div>

      <div className="panel-content">
        <div
          className="drop-zone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          style={{
            border: "2px dashed rgba(255,255,255,0.15)",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center",
            marginBottom: "16px",
            cursor: "pointer",
            transition: "border-color 0.2s",
          }}
        >
          <Upload size={40} style={{ color: "var(--text-muted)", marginBottom: "10px" }} />
          <p style={{ margin: "0 0 6px", color: "var(--text-primary)" }}>拖拽文件到此处或点击选择</p>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            支持 PDF, TXT, MD, HTML, CSV, DOC, DOCX, JSON
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: "none" }}
          accept=".pdf,.txt,.md,.html,.csv,.doc,.docx,.json"
        />

        {files.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>
                已选择 {files.length} 个文件
              </span>
              <button type="button" onClick={() => setFiles([])} style={{ background: "none", border: "none", color: "var(--accent-orange)", fontSize: "0.8rem", cursor: "pointer", padding: 0, minHeight: "unset", boxShadow: "none" }}>
                清除全部
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {files.map((file, index) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", background: "var(--surface-card)", borderRadius: "10px" }}>
                  <FileText size={16} style={{ color: "var(--text-muted)" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{file.name}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{formatFileSize(file.size)}</span>
                  </div>
                  <button type="button" onClick={() => removeFile(index)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer", padding: 0, minHeight: "unset", boxShadow: "none" }} aria-label="移除">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploading && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>上传进度</span>
              <span style={{ fontSize: "0.85rem", color: "var(--accent-orange)", fontFamily: "var(--font-mono)" }}>{Math.round(uploadProgress)}%</span>
            </div>
            <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg, var(--accent-burnt), var(--accent-orange))", width: `${uploadProgress}%`, transition: "width 0.3s ease" }} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button type="button" onClick={handleUpload} disabled={uploading || files.length === 0}>
            {uploading ? "上传中..." : `上传 ${files.length} 个文件`}
          </button>
          <button type="button" className="ghost-button" onClick={handleCreateIndex} disabled={indexing}>
            {indexing ? "创建索引中..." : "创建知识索引"}
          </button>
        </div>

        {message && (
          <div style={{ marginTop: "14px", padding: "12px", background: "var(--surface-card)", borderRadius: "10px", fontSize: "0.85rem", color: message.includes("失败") ? "var(--accent-error)" : "var(--text-muted)" }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
