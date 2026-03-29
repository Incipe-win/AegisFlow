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

const panelMeta: Record<Exclude<PanelType, null>, { title: string; description: string }> = {
  knowledge: {
    title: "知识库面板",
    description: "上传资料、重建索引，并把运维知识送进当前会话的检索上下文。",
  },
  tools: {
    title: "MCP 工具目录",
    description: "查看当前已接入的工具能力，确认诊断动作和数据来源是否在线。",
  },
  ops: {
    title: "运维面板",
    description: "集中查看运维运行、诊断状态和需要人工介入的流程节点。",
  },
};

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
    deleteSession,
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

  const currentHistorySession = useMemo(
    () => historySessions.find((session) => session.id === currentSessionId) ?? null,
    [currentSessionId, historySessions],
  );

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

  const handleCreateSession = async () => {
    setActivePanel(null);
    await startNewSession();
  };

  const activePanelMeta = activePanel ? panelMeta[activePanel] : null;

  return (
    <WorkspaceShell
      sidebar={
        <>
          <ChatHistory
            sessions={historySessions}
            currentSessionId={currentSessionId}
            onSelectSession={switchSession}
            onCreateNewSession={handleCreateSession}
            onDeleteSession={deleteSession}
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

          <div className="sidebar-note workspace-sidebar-note">
            <p>建议流程</p>
            <strong>新建会话 → 上传资料 → 重建索引 → 开始排查</strong>
          </div>
        </>
      }
    >
      <div className="workspace-stage">
        <header className="workspace-overview">
          <div className="workspace-overview-copy">
            <p className="workspace-kicker">Ops Copilot Desk</p>
            <h2>{currentHistorySession?.title ?? "准备开始新的排障会话"}</h2>
            <p>
              {currentHistorySession
                ? currentHistorySession.lastMessage
                  ? "继续当前上下文，知识库命中、工具调用和对话记录都会围绕这个会话展开。"
                  : "这个会话还没有内容，可以从上传资料或直接提问开始。"
                : "点击新建对话后，左侧会话区、右侧能力面板和主聊天流会一起切换到新的上下文。"}
            </p>
          </div>

          <div className="workspace-overview-actions">
            <button
              type="button"
              className="ghost-button workspace-overview-button"
              onClick={() => void handleCreateSession()}
            >
              新建对话
            </button>

            <div className="workspace-overview-stats">
              <article>
                <span>当前会话</span>
                <strong>{currentHistorySession ? "已激活" : "未开始"}</strong>
              </article>
              <article>
                <span>总会话</span>
                <strong>{sessions.length}</strong>
              </article>
              <article>
                <span>当前消息</span>
                <strong>{messages.length}</strong>
              </article>
            </div>
          </div>
        </header>

        <div className={`workspace-frame ${activePanel ? "has-sidecar" : ""}`}>
          <section className="workspace-conversation">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h3>让每一次排障都带着上下文开始</h3>
                  <p>
                    新建对话后，你可以一边提问，一边把知识库、MCP 工具和运维流程挂到同一个工作台里。
                  </p>
                  <div className="quick-tips">
                    <p>推荐从这里开始：</p>
                    <ul>
                      <li><code>/upload</code> 上传运行手册、问题记录或排障笔记</li>
                      <li><code>/tools</code> 检查当前可用的工具与数据源</li>
                      <li><code>/ops</code> 切到运维流程，查看诊断与审批状态</li>
                      <li><code>/clear</code> 快速开启一段新的上下文</li>
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

            <div className="chat-input-container">
              <MessageInput
                onSendMessage={handleSendMessage}
                onCommand={handleCommand}
                isStreaming={isStreaming}
                placeholder="输入消息、问题或命令（以 / 开头）..."
              />

              <div className="input-hints">
                <span>支持拖拽上传文件 · Shift+Enter 换行 · Enter 发送</span>
              </div>
            </div>
          </section>

          <aside className="workspace-sidecar">
            <div className="workspace-sidecar-header">
              <div>
                <p className="workspace-sidecar-kicker">
                  {activePanelMeta ? "Active Panel" : "Capability Lens"}
                </p>
                <h3>{activePanelMeta?.title ?? "选择一个能力面板"}</h3>
                <p>
                  {activePanelMeta?.description ?? "右侧区域会显示你当前打开的知识库、工具或运维面板，让操作结果和对话并排查看。"}
                </p>
              </div>
            </div>

            <div className="workspace-sidecar-body">
              {activePanel === "knowledge" ? (
                <KnowledgePanel onClose={() => setActivePanel(null)} />
              ) : activePanel === "tools" ? (
                <ToolsPanel onClose={() => setActivePanel(null)} />
              ) : activePanel === "ops" ? (
                <OpsPanel onClose={() => setActivePanel(null)} />
              ) : (
                <div className="workspace-sidecar-placeholder">
                  <article>
                    <strong>知识库</strong>
                    <span>把运行手册、经验总结和排障记录装进当前会话。</span>
                  </article>
                  <article>
                    <strong>MCP 工具</strong>
                    <span>查看有哪些实时工具能参与诊断，减少“猜答案”的情况。</span>
                  </article>
                  <article>
                    <strong>运维流程</strong>
                    <span>把分析、执行和审批放在同一个上下文中推进。</span>
                  </article>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}
