import { useState } from "react";

import {
  createSession,
  getRun,
  listRunEvents,
  resumeRun,
  runOps,
  type Run,
  type RunEvent,
} from "../api/client";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";

export function OpsPage() {
  const [sessionId, setSessionId] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [form, setForm] = useState<{
    alertTitle: string;
    serviceName: string;
    severity: "critical" | "warning" | "info";
    summary: string;
  }>({
    alertTitle: "payment-service cpu usage high",
    serviceName: "payment-service",
    severity: "critical" as const,
    summary: "支付服务 CPU 连续 5 分钟高于 90%，错误率上升。",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureSession() {
    if (sessionId) {
      return sessionId;
    }
    const response = await createSession({
      title: "Ops Supervisor Session",
      mode: "ops",
    });
    setSessionId(response.data.id);
    return response.data.id;
  }

  async function loadRun(runId: string) {
    const runResponse = await getRun(runId);
    const eventResponse = await listRunEvents(runId);
    setRun(runResponse.data);
    setEvents(eventResponse.data);
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const currentSessionId = await ensureSession();
      const response = await runOps({
        sessionId: currentSessionId,
        alertTitle: form.alertTitle,
        serviceName: form.serviceName,
        severity: form.severity,
        summary: form.summary,
      });
      await loadRun(response.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ops run 失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleResume() {
    if (!run) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const interruptId = run.interrupt?.contexts?.[0]?.id;
      const response = await resumeRun(run.id, {
        interruptId,
        approved: true,
        note: "Approved from demo console",
      });
      await loadRun(response.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "恢复运行失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-grid">
      <SectionCard
        title="Ops Supervisor Run"
        description="这里展示真实的 Session / Run / Resume 模型，以及 Supervisor + PlanExecute 的结果承载方式。"
      >
        <div className="form-grid">
          <label>
            Session ID
            <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} />
          </label>
          <label>
            Alert Title
            <input
              value={form.alertTitle}
              onChange={(event) =>
                setForm((current) => ({ ...current, alertTitle: event.target.value }))
              }
            />
          </label>
          <label>
            Service Name
            <input
              value={form.serviceName}
              onChange={(event) =>
                setForm((current) => ({ ...current, serviceName: event.target.value }))
              }
            />
          </label>
          <label>
            Severity
            <select
              value={form.severity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  severity: event.target.value as "critical" | "warning" | "info",
                }))
              }
            >
              <option value="critical">critical</option>
              <option value="warning">warning</option>
              <option value="info">info</option>
            </select>
          </label>
          <label className="span-2">
            Summary
            <textarea
              rows={4}
              value={form.summary}
              onChange={(event) =>
                setForm((current) => ({ ...current, summary: event.target.value }))
              }
            />
          </label>
        </div>
        <div className="action-row">
          <button type="button" onClick={handleRun} disabled={loading}>
            {loading ? "运行中..." : "执行 Ops Run"}
          </button>
          {run?.status === "interrupted" ? (
            <button type="button" className="ghost-button" onClick={handleResume} disabled={loading}>
              批准并恢复 Run
            </button>
          ) : null}
          <StatusPill tone="warning">Supervisor + PlanExecute + Resume</StatusPill>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </SectionCard>

      <SectionCard
        title="Run Detail"
        description="如果 ReporterAgent 触发了 approval.request，这里会看到 interrupted 状态和 interrupt context。"
      >
        {run ? (
          <div className="result-block">
            <div className="result-header">
              <h3>{run.id}</h3>
              <StatusPill tone={run.status === "completed" ? "success" : "warning"}>
                {run.status}
              </StatusPill>
            </div>
            <p className="answer-text">{run.summary || "当前没有最终摘要。"}</p>
            <pre>{JSON.stringify(run, null, 2)}</pre>
          </div>
        ) : (
          <p className="hint-line">执行一次 Ops Run 后，这里会显示新的运行对象。</p>
        )}
      </SectionCard>

      <SectionCard
        title="Event Timeline"
        description="展示 transfer、tool_call、message、interrupted 等事件，便于解释 Multi-Agent 执行路径。"
      >
        <div className="result-block">
          <pre>{events.length ? JSON.stringify(events, null, 2) : "暂无事件"}</pre>
        </div>
      </SectionCard>
    </div>
  );
}
