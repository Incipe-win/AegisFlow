import { useState, useRef, ChangeEvent, KeyboardEvent, DragEvent } from "react";

interface MessageInputProps {
  onSendMessage: (content: string, files?: File[]) => void | Promise<void>;
  onCommand?: (command: string) => void | Promise<void>;
  isStreaming?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSendMessage,
  onCommand,
  isStreaming = false,
  placeholder = "输入消息...",
}: MessageInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理输入变化
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  // 处理发送消息
  const handleSend = async () => {
    const trimmedValue = inputValue.trim();

    // 检查是否是命令（以/开头）
    if (trimmedValue.startsWith("/") && onCommand) {
      await onCommand(trimmedValue);
      setInputValue("");
      return;
    }

    // 普通消息
    if (trimmedValue || files.length > 0) {
      await onSendMessage(trimmedValue, files);
      setInputValue("");
      setFiles([]);
    }
  };

  // 处理键盘事件
  const handleKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
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
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 拖拽处理
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  // 获取文件类型图标
  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.includes("pdf")) return "📄";
    if (type.includes("image")) return "🖼️";
    if (type.includes("text")) return "📝";
    if (type.includes("csv") || type.includes("excel")) return "📊";
    if (type.includes("word")) return "📘";
    return "📎";
  };

  // 处理命令按钮点击
  const handleCommandClick = async (command: string) => {
    if (onCommand) {
      await onCommand(command);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={`message-input-container ${isDragging ? "dragging" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 文件预览 */}
      {files.length > 0 && (
        <div className="file-preview">
          <div className="file-preview-header">
            <span>已选择 {files.length} 个文件</span>
            <button type="button" onClick={() => setFiles([])}>清除全部</button>
          </div>
          <div className="file-list">
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <span className="file-icon">{getFileIcon(file)}</span>
                <div className="file-details">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                <button
                  type="button"
                  className="file-remove"
                  onClick={() => removeFile(index)}
                  aria-label="移除文件"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div className="input-area">
        <textarea
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          disabled={isStreaming}
        />

        <div className="input-actions">
          <div className="action-buttons">
            <button
              type="button"
              className="action-button"
              onClick={triggerFileSelect}
              title="上传文件"
              disabled={isStreaming}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: "none" }}
              disabled={isStreaming}
              accept=".pdf,.txt,.md,.html,.csv,.doc,.docx,.json"
            />
          </div>

          <button
            type="button"
            className="send-button"
            onClick={handleSend}
            disabled={isStreaming || (!inputValue.trim() && files.length === 0)}
          >
            {isStreaming ? (
              <>
                <span className="spinner"></span>
                发送中...
              </>
            ) : (
              <>
                发送
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 拖拽提示 */}
      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-message">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p>释放文件以上传</p>
          </div>
        </div>
      )}

      {/* 命令提示 */}
      <div className="command-hints">
        <span>可用命令：</span>
        <button type="button" onClick={() => handleCommandClick("/upload")}>/upload</button>
        <button type="button" onClick={() => handleCommandClick("/tools")}>/tools</button>
        <button type="button" onClick={() => handleCommandClick("/ops")}>/ops</button>
        <button type="button" onClick={() => handleCommandClick("/clear")}>/clear</button>
      </div>
    </div>
  );
}