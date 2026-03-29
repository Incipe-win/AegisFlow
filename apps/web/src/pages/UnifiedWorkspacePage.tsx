import { useState, useRef, useEffect, useMemo } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";

import { WorkspaceShell } from "../components/WorkspaceShell";
import { ChatMessage } from "../components/ChatMessage";
import { MessageInput } from "../components/MessageInput";
import { ChatHistory } from "../components/ChatHistory";
import { KnowledgePanel } from "../components/KnowledgePanel";
import { ToolsPanel } from "../components/ToolsPanel";
import { OpsPanel } from "../components/OpsPanel";

import { useChatSession } from "../hooks/useChatSession";
import { parseCommand, executeCommand } from "../utils/chatCommands";

// 配置marked使用highlight.js进行代码高亮
marked.setOptions({
  breaks: true,
  gfm: true,
});

type PanelType = "knowledge" | "tools" | "ops" | null;

export function UnifiedWorkspacePage() {
  // 聊天会话状态
  const {
    messages,
    currentSessionId,
    sessions,
    isStreaming,
    sendMessage,
    startNewSession,
    switchSession,
    uploadFile,
    addMessage,
  } = useChatSession();

  // 转换会话格式为ChatHistory组件期望的格式
  const historySessions = useMemo(() => {
    return sessions.map(session => ({
      id: session.id,
      title: session.title,
      lastMessage: session.lastMessage,
      timestamp: new Date(session.createdAt),
      messageCount: session.messageCount,
    }));
  }, [sessions]);

  // 侧边面板状态
  const [activePanel, setActivePanel] = useState<PanelType>(null);

  // 消息容器引用，用于自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新消息
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // 处理发送消息
  const handleSendMessage = async (content: string, files?: File[]) => {
    if (!content.trim() && (!files || files.length === 0)) return;

    // 如果有文件，先上传
    if (files && files.length > 0) {
      for (const file of files) {
        await uploadFile(file);
      }
    }

    // 发送文本消息
    if (content.trim()) {
      await sendMessage(content);
    }
  };

  // 处理命令输入
  const handleCommand = async (command: string) => {
    const parsed = parseCommand(command);

    if (!parsed) {
      // 不是命令，作为普通消息发送
      await handleSendMessage(command);
      return;
    }

    // 创建命令上下文
    const context = {
      sessionId: currentSessionId,
      messages,
      setActivePanel,
      sendMessage: async (content: string) => {
        await handleSendMessage(content);
      },
      uploadFiles: async (files: File[]) => {
        for (const file of files) {
          await uploadFile(file);
        }
      },
      startNewSession: async (title?: string) => {
        const newId = await startNewSession(title);
        return newId;
      },
    };

    // 执行命令
    const result = await executeCommand(parsed.command, parsed.args, context);

    // 处理命令结果
    if (result.action === "open_panel") {
      setActivePanel(result.data.panel);
    } else if (result.action === "send_message") {
      await handleSendMessage(result.data.content);
    } else if (result.action === "new_session") {
      await startNewSession(result.data.title);
    } else if (result.action === "upload_files") {
      // 这里可以处理文件上传
    }

    // 显示命令结果消息（如果有）
    if (result.message) {
      const messageId = `command-${Date.now()}`;
      const systemMessage = {
        id: messageId,
        role: "system" as const,
        content: result.success ? `✓ ${result.message}` : `✗ ${result.message}`,
        timestamp: new Date(),
      };

      addMessage(systemMessage);
    }
  };

  // 切换侧边面板
  const togglePanel = (panel: PanelType) => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  return (
    <WorkspaceShell
      sidebar={
        <>
          <ChatHistory
            sessions={historySessions}
            currentSessionId={currentSessionId}
            onSelectSession={switchSession}
            onCreateNewSession={startNewSession}
          />

          <div className="quick-actions">
            <button
              className={`quick-action ${activePanel === "knowledge" ? "active" : ""}`}
              onClick={() => togglePanel("knowledge")}
              title="知识库管理"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                <path d="M9 10h6" />
                <path d="M9 14h6" />
              </svg>
              知识库
            </button>

            <button
              className={`quick-action ${activePanel === "tools" ? "active" : ""}`}
              onClick={() => togglePanel("tools")}
              title="MCP工具目录"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              工具
            </button>

            <button
              className={`quick-action ${activePanel === "ops" ? "active" : ""}`}
              onClick={() => togglePanel("ops")}
              title="运维监控"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              运维
            </button>
          </div>

          {activePanel === "knowledge" && (
            <KnowledgePanel onClose={() => setActivePanel(null)} />
          )}

          {activePanel === "tools" && (
            <ToolsPanel onClose={() => setActivePanel(null)} />
          )}

          {activePanel === "ops" && (
            <OpsPanel onClose={() => setActivePanel(null)} />
          )}
        </>
      }
    >
      <div className="workspace-main">
        {/* 聊天消息区域 */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>欢迎使用智能运维工作台</h3>
              <p>
                开始对话，或者使用侧边栏的功能管理知识库、调用工具或监控运维状态。
              </p>
              <div className="quick-tips">
                <p>试试这些命令：</p>
                <ul>
                  <li><code>/upload</code> - 上传文档到知识库</li>
                  <li><code>/tools</code> - 查看可用工具</li>
                  <li><code>/ops</code> - 查看运维监控</li>
                  <li><code>/clear</code> - 开始新的会话</li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming && message.role === "assistant" && message.id === messages[messages.length - 1].id}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 消息输入区域 */}
        <div className="chat-input-container">
          <MessageInput
            onSendMessage={handleSendMessage}
            onCommand={handleCommand}
            isStreaming={isStreaming}
            placeholder="输入消息或命令（以/开头）..."
          />

          <div className="input-hints">
            <span>支持拖拽上传文件 • 按 Shift+Enter 换行 • 按 Enter 发送</span>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}