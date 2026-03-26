import type { ReactNode } from "react";

type TabKey = "knowledge" | "chat" | "ops";

type ShellProps = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: ReactNode;
};

const tabs: Array<{ key: TabKey; label: string; hint: string }> = [
  { key: "knowledge", label: "知识库", hint: "上传与索引内部文档" },
  { key: "chat", label: "智能问答", hint: "多轮对话与 SSE 输出" },
  { key: "ops", label: "AI 运维", hint: "告警诊断与工具轨迹" },
];

export function Shell({ activeTab, onTabChange, children }: ShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <p className="eyebrow">AegisFlow</p>
          <h1>智能运维 Agent 平台</h1>
          <p className="brand-copy">
            前后端分离、OpenAPI 优先、可用于简历演示的 OnCall MVP。
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
              <span>{tab.label}</span>
              <small>{tab.hint}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <p>演示建议</p>
          <ul>
            <li>先执行一次知识索引</li>
            <li>再演示流式问答</li>
            <li>最后运行告警诊断</li>
          </ul>
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}

