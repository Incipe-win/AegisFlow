import type { ReactNode } from "react";
import { BookOpen, MessageSquare, Activity, Wrench } from "lucide-react";

type TabKey = "knowledge" | "chat" | "ops" | "tools";

type ShellProps = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: ReactNode;
};

const tabs: Array<{ key: TabKey; label: string; hint: string; icon: ReactNode }> = [
  { key: "knowledge", label: "知识库", hint: "上传与索引内部文档", icon: <BookOpen size={20} /> },
  { key: "chat", label: "Chat Run", hint: "ReAct 运行与事件流", icon: <MessageSquare size={20} /> },
  { key: "ops", label: "Ops Run", hint: "Supervisor 与 PlanExecute", icon: <Activity size={20} /> },
  { key: "tools", label: "MCP Tools", hint: "工具目录与协议接入", icon: <Wrench size={20} /> },
];

export function Shell({ activeTab, onTabChange, children }: ShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <p className="eyebrow">AegisFlow</p>
          <h1>智能运维 Agent 平台</h1>
          <p className="brand-copy">
            GoFrame + Eino + RAG + MCP 的真实 Agent 平台演示。
          </p>
        </div>
        <nav className="nav-list">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={tab.key === activeTab ? "nav-item active" : "nav-item"}
              onClick={() => onTabChange(tab.key)}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {tab.icon}
                {tab.label}
              </span>
              <small>{tab.hint}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <p>演示建议</p>
          <ul>
            <li>先创建知识索引任务</li>
            <li>再运行 Chat ReAct</li>
            <li>最后演示 Ops Supervisor 与 Resume</li>
          </ul>
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
