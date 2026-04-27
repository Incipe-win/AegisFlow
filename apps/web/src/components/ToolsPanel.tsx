import { useState, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import { listMCPTools, type MCPToolDescriptor } from "../api/client";

interface ToolsPanelProps {
  onClose: () => void;
}

export function ToolsPanel({ onClose }: ToolsPanelProps) {
  const [tools, setTools] = useState<MCPToolDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { loadTools(); }, []);

  const loadTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listMCPTools();
      setTools(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载工具列表失败");
    } finally {
      setLoading(false);
    }
  };

  const filteredTools = tools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categorizeTool = (tool: MCPToolDescriptor) => {
    const name = tool.name.toLowerCase();
    const description = tool.description?.toLowerCase() || "";
    const categories: Record<string, string[]> = {
      monitoring: ["prometheus", "metrics", "alert", "log"],
      database: ["mysql", "query", "database", "sql"],
      system: ["system", "os", "disk", "memory", "cpu"],
      knowledge: ["knowledge", "search", "document", "rag", "runbook"],
    };
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => name.includes(kw) || description.includes(kw))) return category;
    }
    return "other";
  };

  const categorizedTools = filteredTools.reduce((acc, tool) => {
    const cat = categorizeTool(tool);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tool);
    return acc;
  }, {} as Record<string, MCPToolDescriptor[]>);

  const categoryNames: Record<string, string> = {
    monitoring: "监控工具",
    database: "数据库工具",
    system: "系统工具",
    knowledge: "知识库工具",
    other: "其他工具",
  };

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h4>MCP 工具目录</h4>
        <button type="button" className="panel-close" onClick={onClose} aria-label="关闭">×</button>
      </div>

      <div className="panel-content">
        <div style={{ marginBottom: "16px", position: "relative", display: "flex", alignItems: "center", background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-soft)", borderRadius: "12px", padding: "8px 12px" }}>
          <Search size={16} style={{ color: "var(--text-muted)", marginRight: "8px" }} />
          <input
            type="text"
            placeholder="搜索工具..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: "transparent", border: "none", padding: 0, color: "var(--text-primary)", fontSize: "0.9rem", width: "100%" }}
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.1rem", cursor: "pointer", padding: "0 4px", minHeight: "unset", boxShadow: "none" }}>×</button>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)" }}>
            <div style={{ width: "36px", height: "36px", margin: "0 auto 12px", border: "3px solid rgba(255,255,255,0.08)", borderTopColor: "var(--accent-orange)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            加载工具列表中...
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: "14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "12px", color: "var(--accent-error)", marginBottom: "16px", textAlign: "center" }}>
            {error}
            <button type="button" onClick={loadTools} style={{ display: "block", margin: "10px auto 0", background: "rgba(239,68,68,0.15)", color: "var(--accent-error)", border: "1px solid rgba(239,68,68,0.25)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer", minHeight: "unset", boxShadow: "none" }}>重试</button>
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {Object.entries(categorizedTools).map(([category, categoryTools]) =>
              categoryTools.length > 0 ? (
                <div key={category}>
                  <h5 style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
                    {categoryNames[category] || category}
                  </h5>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {categoryTools.map((tool) => (
                      <div key={tool.name} style={{ padding: "14px", background: "var(--surface-card)", border: "1px solid var(--border-soft)", borderRadius: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                              <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{tool.name}</span>
                              <span style={{ fontSize: "0.68rem", padding: "2px 6px", background: "rgba(16,185,129,0.15)", color: "var(--accent-success)", borderRadius: "8px", fontFamily: "var(--font-mono)" }}>MCP</span>
                            </div>
                            {tool.description && (
                              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>{tool.description}</p>
                            )}
                          </div>
                          <button type="button" onClick={() => navigator.clipboard.writeText(`/call ${tool.name}`)} style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid var(--border-soft)", borderRadius: "8px", padding: "4px 8px", fontSize: "0.72rem", cursor: "pointer", minHeight: "unset", boxShadow: "none", whiteSpace: "nowrap" }}>
                            复制调用
                          </button>
                        </div>
                        {tool.schemaJson && (
                          <details style={{ marginTop: "10px" }}>
                            <summary style={{ fontSize: "0.8rem", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                              <ChevronDown size={12} />
                              查看参数
                            </summary>
                            <pre style={{ margin: "6px 0 0", padding: "10px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", fontSize: "0.75rem", color: "var(--text-muted)", overflowX: "auto" }}>
                              {JSON.stringify(JSON.parse(tool.schemaJson), null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
            {filteredTools.length === 0 && searchQuery && (
              <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>未找到匹配的工具</div>
            )}
          </div>
        )}

        {!loading && !error && tools.length > 0 && (
          <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-around" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--accent-orange)", fontFamily: "var(--font-mono)" }}>{tools.length}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>总工具数</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--accent-success)", fontFamily: "var(--font-mono)" }}>{Object.keys(categorizedTools).length}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>分类数</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
