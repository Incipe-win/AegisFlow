import { useState } from "react";

import { postChat, type ChatResponse } from "../api/client";
import { streamChat } from "../api/stream";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";

export function ChatPage() {
  const [sessionId, setSessionId] = useState("session-001");
  const [question, setQuestion] = useState("支付服务 CPU 告警应该怎么排查？");
  const [syncResult, setSyncResult] = useState<ChatResponse | null>(null);
  const [streamOutput, setStreamOutput] = useState("");
  const [streamEvents, setStreamEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    setLoading(true);
    setError(null);
    try {
      const result = await postChat({
        sessionId,
        question,
        topK: 3,
      });
      setSyncResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "问答失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleStream() {
    setLoading(true);
    setError(null);
    setStreamOutput("");
    setStreamEvents([]);
    try {
      await streamChat(
        {
          sessionId,
          question,
          topK: 3,
        },
        (event) => {
          setStreamEvents((current) => [...current, `${event.event}: ${event.data}`]);
          if (event.event === "message") {
            setStreamOutput((current) => current + event.data);
          }
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "流式问答失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-grid">
      <SectionCard
        title="多轮对话"
        description="相同 sessionId 会保留上下文，问答结果会同时保存到运行记录中。"
      >
        <div className="form-grid">
          <label>
            Session ID
            <input
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
            />
          </label>
          <label className="span-2">
            问题
            <textarea
              rows={4}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
        </div>
        <div className="action-row">
          <button type="button" onClick={handleAsk} disabled={loading}>
            {loading ? "处理中..." : "发送同步问答"}
          </button>
          <button type="button" className="ghost-button" onClick={handleStream} disabled={loading}>
            发送流式问答
          </button>
          <StatusPill>topK=3</StatusPill>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </SectionCard>

      <SectionCard
        title="同步问答结果"
        description="展示最终答案、召回片段和建议追问方向。"
      >
        {syncResult ? (
          <div className="result-block">
            <p className="answer-text">{syncResult.data.answer}</p>
            <div className="chip-list">
              {syncResult.data.suggestions.map((suggestion) => (
                <span key={suggestion} className="chip">
                  {suggestion}
                </span>
              ))}
            </div>
            <div className="list-block">
              <h3>参考片段</h3>
              {syncResult.data.references.map((reference) => (
                <article key={`${reference.documentId}-${reference.title}`} className="reference-card">
                  <div className="result-header">
                    <strong>{reference.title}</strong>
                    <StatusPill tone="success">score {reference.score}</StatusPill>
                  </div>
                  <p>{reference.excerpt}</p>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="hint-line">点击“发送同步问答”后，这里会显示完整回答。</p>
        )}
      </SectionCard>

      <SectionCard
        title="SSE 流式输出"
        description="使用 fetch 读取 text/event-stream，模拟大模型逐段输出的体验。"
      >
        <div className="result-block">
          <div className="result-header">
            <h3>流式文本</h3>
            <StatusPill tone="warning">{streamOutput ? "streaming" : "idle"}</StatusPill>
          </div>
          <p className="answer-text">{streamOutput || "尚未开始流式会话。"}</p>
        </div>
        <div className="result-block">
          <h3>事件轨迹</h3>
          <pre>{streamEvents.length ? streamEvents.join("\n") : "暂无 SSE 事件"}</pre>
        </div>
      </SectionCard>
    </div>
  );
}

