import { useState, useRef, ChangeEvent, KeyboardEvent, DragEvent } from "react";
import { Upload, Send } from "lucide-react";

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

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleSend = async () => {
    const trimmedValue = inputValue.trim();

    if (trimmedValue.startsWith("/") && onCommand) {
      await onCommand(trimmedValue);
      setInputValue("");
      return;
    }

    if (trimmedValue || files.length > 0) {
      await onSendMessage(trimmedValue, files);
      setInputValue("");
      setFiles([]);
    }
  };

  const handleKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

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

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.includes("pdf")) return "📄";
    if (type.includes("image")) return "🖼️";
    if (type.includes("text") || type.includes("markdown")) return "📝";
    if (type.includes("csv") || type.includes("excel")) return "📊";
    return "📎";
  };

  const handleCommandClick = async (command: string) => {
    if (onCommand) {
      await onCommand(command);
    }
  };

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
              <Upload size={18} />
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
                <Send size={16} />
              </>
            )}
          </button>
        </div>
      </div>

      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-message">
            <Upload size={48} />
            <p>释放文件以上传</p>
          </div>
        </div>
      )}

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
