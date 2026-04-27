import { useState } from "react";
import { Plus, Search, MessageSquare, Trash2 } from "lucide-react";

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
  onDeleteSession?: (sessionId: string) => void;
}

export function ChatHistory({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateNewSession,
  onDeleteSession,
}: ChatHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleCreateSession = () => {
    void onCreateNewSession();
  };

  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Plus size={16} />
          新对话
        </button>
      </div>

      <div className="search-box">
        <Search size={16} />
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

      <div className="session-list">
        {filteredSessions.length === 0 ? (
          <div className="empty-sessions">
            <MessageSquare size={40} />
            <p>暂无对话记录</p>
            <button type="button" onClick={handleCreateSession}>
              开始第一个对话
            </button>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${session.id === currentSessionId ? "active" : ""}`}
              onClick={() => onSelectSession(session.id)}
              title={session.title}
              role="button"
              tabIndex={0}
              aria-pressed={session.id === currentSessionId}
            >
              <div className="session-avatar">
                <MessageSquare size={16} />
              </div>

              <div className="session-content">
                <div className="session-title">
                  <span>{session.title}</span>
                  <div className="session-title-actions">
                    <span className="message-count">{session.messageCount}</span>
                    {onDeleteSession && (
                      <button
                        className="delete-session-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("确定要删除这个对话吗？")) {
                            onDeleteSession(session.id);
                          }
                        }}
                        title="删除对话"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
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
            </div>
          ))
        )}
      </div>

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
