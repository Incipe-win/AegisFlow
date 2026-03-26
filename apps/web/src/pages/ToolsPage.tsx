import { useState } from "react";

import { listMCPTools, type MCPToolDescriptor } from "../api/client";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";

export function ToolsPage() {
  const [tools, setTools] = useState<MCPToolDescriptor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try {
      const response = await listMCPTools();
      setTools(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取工具目录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-grid">
      <SectionCard
        title="MCP Tool Catalog"
        description="API 通过 mcp-go client 和 Eino MCP wrapper 消费这些工具；这里展示服务端发现到的协议工具目录。"
      >
        <div className="action-row">
          <button type="button" onClick={handleLoad} disabled={loading}>
            {loading ? "读取中..." : "加载 MCP 工具目录"}
          </button>
          <StatusPill>mcp-go / SSE transport</StatusPill>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
        {tools.length ? (
          <div className="list-block">
            {tools.map((tool) => (
              <article key={tool.name} className="reference-card">
                <div className="result-header">
                  <strong>{tool.name}</strong>
                  <StatusPill tone="success">discovered</StatusPill>
                </div>
                <p>{tool.description || "No description"}</p>
                <pre>{tool.schemaJson || "{}"}</pre>
              </article>
            ))}
          </div>
        ) : (
          <p className="hint-line">点击上面的按钮后，这里会展示 MCP Server 返回的工具描述。</p>
        )}
      </SectionCard>
    </div>
  );
}
