import { useEffect, useState } from "react";
import { marked } from "marked";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    toolName?: string;
    toolInput?: any;
    toolOutput?: any;
    toolError?: string;
    files?: Array<{
      name: string;
      size: number;
      type: string;
      url?: string;
    }>;
  };
}

interface ChatMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const [renderedContent, setRenderedContent] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  // 渲染Markdown内容
  useEffect(() => {
    if (message.content) {
      const renderMarkdown = async () => {
        try {
          const html = await marked(message.content);
          setRenderedContent(html);
        } catch (error) {
          console.error("Markdown渲染失败:", error);
          setRenderedContent(`<pre>${message.content}</pre>`);
        }
      };
      renderMarkdown();
    } else {
      setRenderedContent("");
    }
  }, [message.content]);

  // 处理工具调用显示
  const renderToolMetadata = () => {
    if (!message.metadata) return null;

    const { toolName, toolInput, toolOutput, toolError } = message.metadata;

    return (
      <div className="tool-metadata">
        {toolName && (
          <div className="tool-header">
            <span className="tool-badge">{toolName}</span>
            {toolError ? (
              <span className="tool-status error">失败</span>
            ) : toolOutput ? (
              <span className="tool-status success">完成</span>
            ) : (
              <span className="tool-status pending">执行中</span>
            )}
          </div>
        )}

        {toolInput && (
          <div className="tool-section">
            <strong>输入:</strong>
            <pre>{JSON.stringify(toolInput, null, 2)}</pre>
          </div>
        )}

        {toolOutput && (
          <div className="tool-section">
            <strong>输出:</strong>
            <pre>{JSON.stringify(toolOutput, null, 2)}</pre>
          </div>
        )}

        {toolError && (
          <div className="tool-section error">
            <strong>错误:</strong>
            <pre>{toolError}</pre>
          </div>
        )}
      </div>
    );
  };

  // 处理文件附件显示
  const renderFileAttachments = () => {
    if (!message.metadata?.files || message.metadata.files.length === 0) return null;

    return (
      <div className="file-attachments">
        {message.metadata.files.map((file, index) => (
          <div key={index} className="file-attachment">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
            {file.url && (
              <a href={file.url} target="_blank" rel="noopener noreferrer" className="file-download">
                下载
              </a>
            )}
          </div>
        ))}
      </div>
    );
  };

  // 获取角色显示名称和图标
  const getRoleConfig = () => {
    switch (message.role) {
      case "user":
        return {
          name: "用户",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          ),
          className: "user-message",
        };
      case "assistant":
        return {
          name: "助手",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
              <path d="M12 8v4l3 3" />
            </svg>
          ),
          className: "assistant-message",
        };
      case "system":
        return {
          name: "系统",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ),
          className: "system-message",
        };
      case "tool":
        return {
          name: message.metadata?.toolName || "工具",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          ),
          className: "tool-message",
        };
      default:
        return {
          name: "未知",
          icon: null,
          className: "",
        };
    }
  };

  const roleConfig = getRoleConfig();
  const formattedTime = message.timestamp.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`chat-message ${roleConfig.className} ${isStreaming ? "streaming" : ""}`}>
      <div className="message-header">
        <div className="message-avatar">
          {roleConfig.icon}
        </div>
        <div className="message-info">
          <span className="message-role">{roleConfig.name}</span>
          <span className="message-time">{formattedTime}</span>
        </div>
        <button
          className="raw-toggle"
          onClick={() => setShowRaw(!showRaw)}
          title="切换原始/渲染视图"
        >
          {showRaw ? "渲染" : "原始"}
        </button>
      </div>

      <div className="message-content">
        {showRaw ? (
          <pre className="raw-content">{message.content}</pre>
        ) : (
          <>
            {message.metadata?.files && message.metadata.files.length > 0 && renderFileAttachments()}
            {message.metadata?.toolName && renderToolMetadata()}
            {message.content && (
              <div
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: renderedContent }}
              />
            )}
            {isStreaming && (
              <div className="streaming-indicator">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}