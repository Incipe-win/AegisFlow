import { useState, useEffect } from "react";
import { listMCPTools, type MCPToolDescriptor } from "../api/client";

interface ToolsPanelProps {
  onClose: () => void;
}

export function ToolsPanel({ onClose }: ToolsPanelProps) {
  const [tools, setTools] = useState<MCPToolDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 加载工具列表
  useEffect(() => {
    loadTools();
  }, []);

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

  // 过滤工具
  const filteredTools = tools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 复制工具调用示例
  const copyToolExample = (tool: MCPToolDescriptor) => {
    const example = `/call ${tool.name}`;
    navigator.clipboard.writeText(example);
    // 可以添加复制成功的反馈
  };

  // 工具分类
  const toolCategories = {
    monitoring: ["prometheus", "metrics", "alert", "log"],
    database: ["mysql", "query", "database", "sql"],
    system: ["system", "os", "disk", "memory", "cpu"],
    knowledge: ["knowledge", "search", "document", "rag"],
    other: [],
  };

  const categorizeTool = (tool: MCPToolDescriptor) => {
    const name = tool.name.toLowerCase();
    const description = tool.description?.toLowerCase() || "";

    for (const [category, keywords] of Object.entries(toolCategories)) {
      if (keywords.some((keyword) => name.includes(keyword) || description.includes(keyword))) {
        return category;
      }
    }
    return "other";
  };

  // 按分类分组
  const categorizedTools = filteredTools.reduce(
    (acc, tool) => {
      const category = categorizeTool(tool);
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tool);
      return acc;
    },
    {} as Record<string, MCPToolDescriptor[]>
  );

  // 分类显示名称
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
        <button type="button" className="panel-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>

      <div className="panel-content">
        {/* 搜索框 */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "10px 12px",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              style={{ color: "rgba(244, 239, 232, 0.5)", marginRight: "8px" }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="搜索工具..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: "#f4efe8",
                fontSize: "0.95rem",
                width: "100%",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(244, 239, 232, 0.5)",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "0 4px",
                }}
                aria-label="清除搜索"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "rgba(244, 239, 232, 0.5)" }}>
            <div style={{ width: "40px", height: "40px", margin: "0 auto 16px" }}>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  border: "3px solid rgba(244, 239, 232, 0.1)",
                  borderTopColor: "#ef8354",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
            </div>
            加载工具列表中...
          </div>
        )}

        {/* 错误状态 */}
        {error && !loading && (
          <div
            style={{
              padding: "16px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "12px",
              color: "#ef4444",
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            {error}
            <button
              type="button"
              onClick={loadTools}
              style={{
                display: "block",
                margin: "12px auto 0",
                background: "rgba(239, 68, 68, 0.2)",
                color: "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              重试
            </button>
          </div>
        )}

        {/* 工具列表 */}
        {!loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {Object.entries(categorizedTools).map(([category, categoryTools]) =>
              categoryTools.length > 0 ? (
                <div key={category}>
                  <h5
                    style={{
                      margin: "0 0 12px",
                      fontSize: "0.95rem",
                      color: "rgba(244, 239, 232, 0.7)",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {categoryNames[category] || category}
                  </h5>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {categoryTools.map((tool) => (
                      <div
                        key={tool.name}
                        style={{
                          padding: "16px",
                          background: "rgba(255, 255, 255, 0.04)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: "12px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                              <span style={{ fontSize: "0.95rem", fontWeight: "600", color: "#f4efe8" }}>
                                {tool.name}
                              </span>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "2px 6px",
                                  background: "rgba(97, 209, 190, 0.2)",
                                  color: "#61d1be",
                                  borderRadius: "10px",
                                }}
                              >
                                MCP
                              </span>
                            </div>
                            {tool.description && (
                              <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(244, 239, 232, 0.6)" }}>
                                {tool.description}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToolExample(tool)}
                            style={{
                              background: "rgba(255, 255, 255, 0.08)",
                              color: "rgba(244, 239, 232, 0.7)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: "8px",
                              padding: "4px 8px",
                              fontSize: "0.8rem",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            复制调用
                          </button>
                        </div>

                        {tool.schemaJson && (
                          <div style={{ marginTop: "12px" }}>
                            <details>
                              <summary
                                style={{
                                  fontSize: "0.85rem",
                                  color: "rgba(244, 239, 232, 0.5)",
                                  cursor: "pointer",
                                  listStyle: "none",
                                }}
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                  查看参数
                                </span>
                              </summary>
                              <pre
                                style={{
                                  margin: "8px 0 0",
                                  padding: "12px",
                                  background: "rgba(0, 0, 0, 0.2)",
                                  borderRadius: "8px",
                                  fontSize: "0.8rem",
                                  color: "rgba(244, 239, 232, 0.7)",
                                  overflowX: "auto",
                                }}
                              >
                                {JSON.stringify(JSON.parse(tool.schemaJson), null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}

            {filteredTools.length === 0 && searchQuery && (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "rgba(244, 239, 232, 0.5)" }}>
                未找到匹配的工具
              </div>
            )}
          </div>
        )}

        {/* 工具统计 */}
        {!loading && !error && tools.length > 0 && (
          <div
            style={{
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-around",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#ef8354" }}>{tools.length}</div>
              <div style={{ fontSize: "0.8rem", color: "rgba(244, 239, 232, 0.5)" }}>总工具数</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#61d1be" }}>
                {Object.keys(categorizedTools).length}
              </div>
              <div style={{ fontSize: "0.8rem", color: "rgba(244, 239, 232, 0.5)" }}>分类数</div>
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.9rem", color: "rgba(244, 239, 232, 0.7)", fontWeight: "500" }}>
            使用说明
          </p>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.85rem", color: "rgba(244, 239, 232, 0.6)" }}>
            <li>点击"复制调用"复制工具调用命令</li>
            <li>在聊天中输入命令使用工具</li>
            <li>工具通过 MCP 协议提供</li>
            <li>部分工具需要特定权限</li>
          </ul>
        </div>
      </div>
    </div>
  );
}