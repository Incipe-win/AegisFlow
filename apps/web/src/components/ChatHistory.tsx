import { useState } from "react";

export interface ChatSession {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: Date;
  messageCount: number;
}

interface ChatHistoryProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onCreateNewSession: () => void | Promise<void>;
}

export function ChatHistory({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateNewSession,
}: ChatHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleCreateSession = () => {
    void onCreateNewSession();
  };

  // 过滤会话
  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 格式化时间显示
  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  // 截断文本
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className="chat-history">
      <div className="history-header">
        <h3>对话历史</h3>
        <button
          type="button"
          className="new-session-button"
          onClick={handleCreateSession}
          title="开始新对话"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新对话
        </button>
      </div>

      {/* 搜索框 */}
      <div className="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="搜索对话..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="clear-search"
            onClick={() => setSearchQuery("")}
            aria-label="清除搜索"
          >
            ×
          </button>
        )}
      </div>

      {/* 会话列表 */}
      <div className="session-list">
        {filteredSessions.length === 0 ? (
          <div className="empty-sessions">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>暂无对话记录</p>
            <button type="button" onClick={handleCreateSession}>
              开始第一个对话
            </button>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <button
              type="button"
              key={session.id}
              className={`session-item ${session.id === currentSessionId ? "active" : ""}`}
              onClick={() => onSelectSession(session.id)}
              title={session.title}
              aria-pressed={session.id === currentSessionId}
            >
              <div className="session-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>

              <div className="session-content">
                <div className="session-title">
                  <span>{session.title}</span>
                  <span className="message-count">{session.messageCount}</span>
                </div>

                {session.lastMessage && (
                  <p className="session-preview">
                    {truncateText(session.lastMessage, 60)}
                  </p>
                )}

                <div className="session-meta">
                  <span className="session-time">{formatTime(session.timestamp)}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* 会话统计 */}
      {sessions.length > 0 && (
        <div className="session-stats">
          <div className="stat-item">
            <span className="stat-label">总对话</span>
            <span className="stat-value">{sessions.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">总消息</span>
            <span className="stat-value">
              {sessions.reduce((sum, session) => sum + session.messageCount, 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
