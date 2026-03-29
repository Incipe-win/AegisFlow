import type { ReactNode } from "react";

interface WorkspaceShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function WorkspaceShell({ sidebar, children }: WorkspaceShellProps) {
  return (
    <div className="workspace-shell">
      {/* 侧边栏 */}
      <aside className="workspace-sidebar">
        <div className="sidebar-header">
          <div className="brand-block">
            <p className="eyebrow">AegisFlow</p>
            <h1>智能运维工作台</h1>
            <p className="brand-copy">
              统一聊天界面，集成知识库、运维工具和MCP协议。
            </p>
          </div>
        </div>

        <div className="sidebar-content">
          {sidebar}
        </div>

        <div className="sidebar-footer">
          <div className="status-indicator">
            <span className="status-dot connected"></span>
            <span>已连接</span>
          </div>
          <div className="version-info">v1.0.0</div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="workspace-main">
        {children}
      </main>
    </div>
  );
}