import { useState, useRef, ChangeEvent, DragEvent } from "react";
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

  // 处理文件选择
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 触发文件选择对话框
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 移除文件
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 拖拽处理
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  // 上传文件
  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage("请先选择文件");
      return;
    }

    setUploading(true);
    setMessage(null);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setMessage(`正在上传: ${file.name}`);

        await uploadKnowledgeDocument(file);

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

  // 创建索引任务
  const handleCreateIndex = async () => {
    setIndexing(true);
    setMessage("正在创建知识索引...");

    try {
      await createKnowledgeIndexJob({
        documentIds: [], // 可以为空，索引所有文档
        chunkSize: 500,
        overlap: 80,
        topK: 4,
      });

      setMessage("知识索引任务已创建");
    } catch (err) {
      setMessage(`创建索引失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setIndexing(false);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 获取文件类型图标
  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.includes("pdf")) return "📄";
    if (type.includes("image")) return "🖼️";
    if (type.includes("text")) return "📝";
    if (type.includes("csv") || type.includes("excel")) return "📊";
    if (type.includes("word")) return "📘";
    if (type.includes("markdown")) return "📖";
    return "📎";
  };

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h4>知识库管理</h4>
        <button type="button" className="panel-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>

      <div className="panel-content">
        {/* 文件上传区域 */}
        <div
          className="drop-zone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            border: "2px dashed rgba(255, 255, 255, 0.2)",
            borderRadius: "12px",
            padding: "24px",
            textAlign: "center",
            marginBottom: "20px",
            cursor: "pointer",
          }}
          onClick={triggerFileSelect}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            style={{ color: "rgba(244, 239, 232, 0.5)", marginBottom: "12px" }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p style={{ margin: "0 0 8px", color: "rgba(244, 239, 232, 0.8)" }}>
            拖拽文件到此处或点击选择
          </p>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(244, 239, 232, 0.5)" }}>
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

        {/* 文件列表 */}
        {files.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "0.9rem", color: "rgba(244, 239, 232, 0.7)", fontWeight: "500" }}>
                已选择 {files.length} 个文件
              </span>
              <button
                type="button"
                onClick={() => setFiles([])}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef8354",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                清除全部
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {files.map((file, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px",
                    background: "rgba(255, 255, 255, 0.05)",
                    borderRadius: "10px",
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>{getFileIcon(file)}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "0.9rem", color: "#f4efe8" }}>{file.name}</span>
                    <span style={{ fontSize: "0.8rem", color: "rgba(244, 239, 232, 0.5)" }}>
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(244, 239, 232, 0.5)",
                      fontSize: "1.5rem",
                      cursor: "pointer",
                      padding: 0,
                      width: "24px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label="移除文件"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 上传进度 */}
        {uploading && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "0.9rem", color: "rgba(244, 239, 232, 0.7)" }}>上传进度</span>
              <span style={{ fontSize: "0.9rem", color: "#ef8354" }}>{Math.round(uploadProgress)}%</span>
            </div>
            <div
              style={{
                height: "6px",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #ef8354, #e9b44c)",
                  width: `${uploadProgress}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            style={{
              width: "100%",
              padding: "12px",
              background: uploading
                ? "rgba(255, 255, 255, 0.1)"
                : "linear-gradient(135deg, #ef8354, #e9b44c)",
              color: uploading ? "rgba(244, 239, 232, 0.7)" : "#13202d",
              border: "none",
              borderRadius: "12px",
              fontWeight: "600",
              cursor: uploading ? "wait" : "pointer",
            }}
          >
            {uploading ? "上传中..." : `上传 ${files.length} 个文件`}
          </button>

          <button
            type="button"
            onClick={handleCreateIndex}
            disabled={indexing}
            style={{
              width: "100%",
              padding: "12px",
              background: indexing
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(97, 209, 190, 0.2)",
              color: indexing
                ? "rgba(244, 239, 232, 0.7)"
                : "#61d1be",
              border: "1px solid rgba(97, 209, 190, 0.3)",
              borderRadius: "12px",
              fontWeight: "600",
              cursor: indexing ? "wait" : "pointer",
            }}
          >
            {indexing ? "创建索引中..." : "创建知识索引"}
          </button>
        </div>

        {/* 状态消息 */}
        {message && (
          <div
            style={{
              marginTop: "20px",
              padding: "12px",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "10px",
              fontSize: "0.9rem",
              color: message.includes("失败")
                ? "#ef4444"
                : message.includes("成功")
                ? "#10b981"
                : "rgba(244, 239, 232, 0.8)",
            }}
          >
            {message}
          </div>
        )}

        {/* 使用说明 */}
        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.9rem", color: "rgba(244, 239, 232, 0.7)", fontWeight: "500" }}>
            使用说明
          </p>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.85rem", color: "rgba(244, 239, 232, 0.6)" }}>
            <li>上传的文档将存储在知识库中</li>
            <li>创建索引后可在聊天中检索</li>
            <li>支持多种文档格式</li>
            <li>单个文件最大 50MB</li>
          </ul>
        </div>
      </div>
    </div>
  );
}