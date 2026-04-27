import type { ReactNode } from "react";
import { Activity } from "lucide-react";

interface WorkspaceShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function WorkspaceShell({ sidebar, children }: WorkspaceShellProps) {
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="sidebar-header">
          <div className="brand-block">
            <p className="eyebrow">AegisFlow</p>
            <h1>智能运维工作台</h1>
            <p className="brand-copy">
              面向值班和排障的一体化工作区，把知识、工具和执行上下文收在同一块桌面上。
            </p>
          </div>
        </div>

        <div className="sidebar-content">{sidebar}</div>

        <div className="sidebar-footer">
          <div className="status-indicator">
            <span className="status-dot connected"></span>
            <span>已连接</span>
          </div>
          <div className="version-info">v2.0.0</div>
        </div>
      </aside>

      <main className="workspace-main">{children}</main>
    </div>
  );
}
