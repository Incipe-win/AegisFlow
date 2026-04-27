import { useEffect, useState } from "react";
import { marked } from "marked";
import { User, Bot, CheckCircle, Wrench } from "lucide-react";

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

  useEffect(() => {
    if (message.content) {
      const renderMarkdown = async () => {
        try {
          const html = await marked(message.content);
          setRenderedContent(html);
        } catch {
          setRenderedContent(`<pre>${message.content}</pre>`);
        }
      };
      renderMarkdown();
    } else {
      setRenderedContent("");
    }
  }, [message.content]);

  const getRoleConfig = () => {
    switch (message.role) {
      case "user":
        return { name: "用户", icon: <User size={16} />, className: "user-message" };
      case "assistant":
        return { name: "助手", icon: <Bot size={16} />, className: "assistant-message" };
      case "system":
        return { name: "系统", icon: <CheckCircle size={16} />, className: "system-message" };
      case "tool":
        return { name: message.metadata?.toolName || "工具", icon: <Wrench size={16} />, className: "tool-message" };
      default:
        return { name: "未知", icon: null, className: "" };
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
            {message.metadata?.files && message.metadata.files.length > 0 && (
              <div className="file-attachments">
                {message.metadata.files.map((file, index) => (
                  <div key={index} className="file-attachment">
                    <div className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {message.metadata?.toolName && (
              <div className="tool-metadata">
                <div className="tool-header">
                  <span className="tool-badge">{message.metadata.toolName}</span>
                  {message.metadata.toolError ? (
                    <span className="tool-status error">失败</span>
                  ) : message.metadata.toolOutput ? (
                    <span className="tool-status success">完成</span>
                  ) : (
                    <span className="tool-status pending">执行中</span>
                  )}
                </div>
                {message.metadata.toolOutput && (
                  <div className="tool-section">
                    <strong>输出:</strong>
                    <pre>{JSON.stringify(message.metadata.toolOutput, null, 2)}</pre>
                  </div>
                )}
                {message.metadata.toolError && (
                  <div className="tool-section">
                    <strong>错误:</strong>
                    <pre>{message.metadata.toolError}</pre>
                  </div>
                )}
              </div>
            )}
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
