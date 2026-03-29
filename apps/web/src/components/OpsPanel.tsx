import { useState } from "react";
import { runOps } from "../api/client";

interface OpsPanelProps {
  onClose: () => void;
}

export function OpsPanel({ onClose }: OpsPanelProps) {
  const [sessionId, setSessionId] = useState("");
  const [query, setQuery] = useState("服务器 CPU 使用率异常升高，请帮我分析原因");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  // 预定义运维查询示例
  const exampleQueries = [
    {
      title: "CPU 告警",
      query: "服务器 CPU 使用率异常升高，请帮我分析原因",
      description: "分析 CPU 使用率异常的根因",
    },
    {
      title: "内存泄漏",
      query: "应用内存持续增长，疑似内存泄漏，请诊断",
      description: "诊断内存泄漏问题",
    },
    {
      title: "服务中断",
      query: "API 服务响应时间变慢，部分请求超时",
      description: "分析服务性能下降原因",
    },
    {
      title: "磁盘空间",
      query: "服务器磁盘空间不足，请分析占用情况",
      description: "分析磁盘空间使用情况",
    },
  ];

  // 执行运维分析
  const handleRunOps = async () => {
    if (!query.trim()) {
      setMessage("请输入查询内容");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // 如果没有会话ID，先创建一个（这里简化处理，实际应该调用创建会话API）
      let targetSessionId = sessionId;
      if (!targetSessionId) {
        // 在实际应用中，这里应该调用 createSession API
        targetSessionId = `ops-session-${Date.now()}`;
        setSessionId(targetSessionId);
      }

      // 根据OpsRunRequest接口构造请求
      const response = await runOps({
        sessionId: targetSessionId,
        alertTitle: "运维告警分析",
        serviceName: "unknown", // 可以从查询中提取，这里简化
        severity: "warning", // 默认为warning
        summary: query.trim(),
      });

      setCurrentRunId(response.data.id);
      setMessage(`运维分析任务已启动 (运行ID: ${response.data.id})`);
    } catch (err) {
      setMessage(`运维分析失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  // 选择示例查询
  const selectExampleQuery = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  // 复制会话ID
  const copySessionId = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      setMessage("会话ID已复制到剪贴板");
    }
  };

  // 生成新会话ID
  const generateNewSession = () => {
    const newSessionId = `ops-session-${Date.now()}`;
    setSessionId(newSessionId);
    setMessage(`已创建新会话: ${newSessionId}`);
  };

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h4>运维分析</h4>
        <button type="button" className="panel-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>

      <div className="panel-content">
        {/* 会话管理 */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "rgba(244, 239, 232, 0.7)" }}>
            会话 ID
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="留空自动创建新会话"
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "10px",
                color: "#f4efe8",
                fontSize: "0.9rem",
              }}
            />
            <button
              type="button"
              onClick={copySessionId}
              disabled={!sessionId}
              style={{
                padding: "10px 12px",
                background: "rgba(255, 255, 255, 0.08)",
                color: "rgba(244, 239, 232, 0.7)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "10px",
                fontSize: "0.85rem",
                cursor: sessionId ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
              }}
            >
              复制
            </button>
            <button
              type="button"
              onClick={generateNewSession}
              style={{
                padding: "10px 12px",
                background: "rgba(97, 209, 190, 0.2)",
                color: "#61d1be",
                border: "1px solid rgba(97, 209, 190, 0.3)",
                borderRadius: "10px",
                fontSize: "0.85rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              新建
            </button>
          </div>
        </div>

        {/* 查询输入 */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "rgba(244, 239, 232, 0.7)" }}>
            运维查询
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: "12px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              color: "#f4efe8",
              fontSize: "0.95rem",
              lineHeight: "1.5",
              resize: "vertical",
            }}
            placeholder="描述您遇到的运维问题..."
          />
        </div>

        {/* 示例查询 */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "rgba(244, 239, 232, 0.7)", fontWeight: "500" }}>
            示例查询
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
            {exampleQueries.map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => selectExampleQuery(example.query)}
                style={{
                  padding: "12px",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.07)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                }}
              >
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#f4efe8", marginBottom: "4px" }}>
                  {example.title}
                </div>
                <div style={{ fontSize: "0.8rem", color: "rgba(244, 239, 232, 0.6)" }}>
                  {example.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 执行按钮 */}
        <button
          type="button"
          onClick={handleRunOps}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            background: loading
              ? "rgba(255, 255, 255, 0.1)"
              : "linear-gradient(135deg, #ef8354, #e9b44c)",
            color: loading ? "rgba(244, 239, 232, 0.7)" : "#13202d",
            border: "none",
            borderRadius: "12px",
            fontWeight: "600",
            fontSize: "0.95rem",
            cursor: loading ? "wait" : "pointer",
            marginBottom: "20px",
          }}
        >
          {loading ? "分析中..." : "执行运维分析"}
        </button>

        {/* 状态消息 */}
        {message && (
          <div
            style={{
              padding: "14px",
              background: message.includes("失败")
                ? "rgba(239, 68, 68, 0.1)"
                : message.includes("成功") || message.includes("已启动")
                ? "rgba(16, 185, 129, 0.1)"
                : "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${
                message.includes("失败")
                  ? "rgba(239, 68, 68, 0.3)"
                  : message.includes("成功") || message.includes("已启动")
                  ? "rgba(16, 185, 129, 0.3)"
                  : "rgba(255, 255, 255, 0.08)"
              }`,
              borderRadius: "12px",
              fontSize: "0.9rem",
              color: message.includes("失败")
                ? "#ef4444"
                : message.includes("成功") || message.includes("已启动")
                ? "#10b981"
                : "rgba(244, 239, 232, 0.8)",
              marginBottom: "20px",
            }}
          >
            {message}
            {currentRunId && (
              <div style={{ marginTop: "8px", fontSize: "0.85rem", color: "rgba(244, 239, 232, 0.6)" }}>
                运行 ID: <code style={{ background: "rgba(0, 0, 0, 0.2)", padding: "2px 6px", borderRadius: "4px" }}>
                  {currentRunId}
                </code>
              </div>
            )}
          </div>
        )}

        {/* 运维流程说明 */}
        <div style={{ marginBottom: "20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "rgba(244, 239, 232, 0.7)", fontWeight: "500" }}>
            运维分析流程
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "rgba(239, 131, 84, 0.2)",
                  color: "#ef8354",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: "500", color: "#f4efe8", marginBottom: "2px" }}>
                  问题描述
                </div>
                <div style={{ fontSize: "0.8rem", color: "rgba(244, 239, 232, 0.6)" }}>
                  详细描述遇到的运维问题
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "rgba(97, 209, 190, 0.2)",
                  color: "#61d1be",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: "500", color: "#f4efe8", marginBottom: "2px" }}>
                  智能分析
                </div>
                <div style={{ fontSize: "0.8rem", color: "rgba(244, 239, 232, 0.6)" }}>
                  AI 代理自动分析日志、指标和文档
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: "rgba(139, 92, 246, 0.2)",
                  color: "#8b5cf6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  flexShrink: 0,
                }}
              >
                3
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: "500", color: "#f4efe8", marginBottom: "2px" }}>
                  解决方案
                </div>
                <div style={{ fontSize: "0.8rem", color: "rgba(244, 239, 232, 0.6)" }}>
                  提供根因分析和处理建议
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 支持的功能 */}
        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.9rem", color: "rgba(244, 239, 232, 0.7)", fontWeight: "500" }}>
            支持的功能
          </p>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.85rem", color: "rgba(244, 239, 232, 0.6)" }}>
            <li>Prometheus 指标查询与分析</li>
            <li>系统日志搜索与过滤</li>
            <li>MySQL 性能诊断</li>
            <li>运维手册智能检索</li>
            <li>多 Agent 协作分析</li>
          </ul>
        </div>
      </div>
    </div>
  );
}