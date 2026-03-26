import { useState } from "react";

import { createSession, getRun, listRunEvents, runChat, type Run, type RunEvent } from "../api/client";
import { streamChatRun } from "../api/stream";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";

export function ChatPage() {
  const [sessionId, setSessionId] = useState("");
  const [sessionTitle, setSessionTitle] = useState("Chat Agent Session");
  const [query, setQuery] = useState("支付服务 CPU 告警应该怎么排查？");
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [streamText, setStreamText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureSession() {
    if (sessionId) {
      return sessionId;
    }
    const response = await createSession({
      title: sessionTitle,
      mode: "chat",
    });
    setSessionId(response.data.id);
    return response.data.id;
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const currentSessionId = await ensureSession();
      const response = await runChat({
        sessionId: currentSessionId,
        query,
        topK: 4,
      });
      setRun(response.data);
      const eventResponse = await listRunEvents(response.data.id);
      setEvents(eventResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat run 失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleStream() {
    setLoading(true);
    setError(null);
    setStreamText("");
    setEvents([]);
    try {
      const currentSessionId = await ensureSession();
      await streamChatRun(
        {
          sessionId: currentSessionId,
          query,
          topK: 4,
        },
        async (frame) => {
          if (frame.event === "run_event") {
            const event = JSON.parse(frame.data) as RunEvent;
            setEvents((current) => [...current, event]);
            if (event.role === "assistant" && event.content) {
              setStreamText((current) => current + event.content);
            }
            return;
          }
          if (frame.event === "done") {
            const completedRun = JSON.parse(frame.data) as Run;
            setRun(completedRun);
            const reloaded = await getRun(completedRun.id);
            setRun(reloaded.data);
          }
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "流式 Chat run 失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-grid">
      <SectionCard
        title="Chat Session 与 ReAct Run"
        description="这里直接走新的 session/run API，展示真实 Agent 运行结果和事件流。"
      >
        <div className="form-grid">
          <label>
            Session Title
            <input value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} />
          </label>
          <label>
            Session ID
            <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} />
          </label>
          <label className="span-2">
            Query
            <textarea rows={4} value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        <div className="action-row">
          <button type="button" onClick={handleRun} disabled={loading}>
            {loading ? "运行中..." : "执行 Chat Run"}
          </button>
          <button type="button" className="ghost-button" onClick={handleStream} disabled={loading}>
            流式执行 Chat Run
          </button>
          <StatusPill>{sessionId ? "session ready" : "create on demand"}</StatusPill>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </SectionCard>

      <SectionCard
        title="Run Summary"
        description="这里展示最终 run 状态、summary 和 checkpoint 信息。"
      >
        {run ? (
          <div className="result-block">
            <div className="result-header">
              <h3>{run.id}</h3>
              <StatusPill tone={run.status === "completed" ? "success" : "warning"}>
                {run.status}
              </StatusPill>
            </div>
            <p className="answer-text">{run.summary || "当前尚无最终摘要。"}</p>
            <pre>{JSON.stringify(run, null, 2)}</pre>
          </div>
        ) : (
          <p className="hint-line">执行一次 Chat Run 后，这里会显示新的运行详情。</p>
        )}
      </SectionCard>

      <SectionCard
        title="Event Timeline"
        description="展示 Assistant、Tool、Transfer 等事件，流式运行时会实时追加。"
      >
        <div className="result-block">
          <div className="result-header">
            <h3>Streaming assistant text</h3>
            <StatusPill tone="warning">{streamText ? "live" : "idle"}</StatusPill>
          </div>
          <p className="answer-text">{streamText || "尚未开始流式输出。"}</p>
        </div>
        <div className="result-block">
          <h3>Run Events</h3>
          <pre>{events.length ? JSON.stringify(events, null, 2) : "暂无事件"}</pre>
        </div>
      </SectionCard>
    </div>
  );
}

