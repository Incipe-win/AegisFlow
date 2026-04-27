import { useState } from "react";
import { createSession, getRun, listRunEvents, resumeRun, type Run, type RunEvent } from "../api/client";
import { streamOpsRun } from "../api/stream";

interface OpsPanelProps {
  onClose: () => void;
}

export function OpsPanel({ onClose }: OpsPanelProps) {
  const [form, setForm] = useState({
    alertTitle: "",
    serviceName: "",
    severity: "warning" as "critical" | "warning" | "info",
    summary: "",
  });
  const [sessionId, setSessionId] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureSession() {
    if (sessionId) return sessionId;
    const response = await createSession({ title: "Ops Diagnosis", mode: "ops" });
    setSessionId(response.data.id);
    return response.data.id;
  }

  async function handleRun() {
    if (!form.alertTitle.trim() || !form.serviceName.trim() || !form.summary.trim()) {
      setError("Alert title, service name, and summary are required.");
      return;
    }
    setLoading(true);
    setError(null);
    setEvents([]);
    setRun(null);

    try {
      const sid = await ensureSession();
      await streamOpsRun(
        { sessionId: sid, ...form },
        (frame) => {
          if (frame.event === "run_event") {
            const evt = JSON.parse(frame.data) as RunEvent;
            setEvents((prev) => [...prev, evt]);
            if (evt.eventType === "interrupted") {
              getRun(evt.runId).then((resp) => {
                setRun(resp.data);
                loadRunEvents(resp.data.id);
              });
            }
          }
          if (frame.event === "done") {
            const completedRun = JSON.parse(frame.data) as Run;
            setRun(completedRun);
          }
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ops run failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleResume(approved: boolean) {
    if (!run || !run.interrupt?.contexts?.[0]?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await resumeRun(run.id, {
        interruptId: run.interrupt.contexts[0].id,
        approved,
        note: approved ? "Approved" : "Rejected by operator",
      });
      setRun(response.data);
      getRun(response.data.id).then((resp) => {
        setRun(resp.data);
        loadRunEvents(resp.data.id);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadRunEvents(runId: string) {
    const resp = await listRunEvents(runId);
    setEvents(resp.data);
  }

  const isInterrupted = run?.status === "interrupted";
  const isCompleted = run?.status === "completed";
  const isFailed = run?.status === "failed";

  return (
    <div className="panel-container">
      <div className="panel-header">
        <h4>Ops Supervisor</h4>
        <button type="button" className="panel-close" onClick={onClose} aria-label="close">
          ×
        </button>
      </div>

      <div className="panel-content">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Alert Title
            <input
              value={form.alertTitle}
              onChange={(e) => setForm((f) => ({ ...f, alertTitle: e.target.value }))}
              placeholder="e.g. payment-service CPU usage high"
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Service Name
              <input
                value={form.serviceName}
                onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
                placeholder="e.g. payment-service"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Severity
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as typeof form.severity }))}
              >
                <option value="critical">critical</option>
                <option value="warning">warning</option>
                <option value="info">info</option>
              </select>
            </label>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Summary
            <textarea
              rows={3}
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="Describe the incident context..."
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Session ID
            <input
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Auto-created if empty"
            />
          </label>
        </div>

        <button type="button" onClick={handleRun} disabled={loading} style={{ width: "100%", marginBottom: "20px" }}>
          {loading ? "Running..." : "Execute Ops Run"}
        </button>

        {isInterrupted && (
          <div style={{ padding: "16px", background: "rgba(247,147,26,0.1)", border: "1px solid rgba(247,147,26,0.3)", borderRadius: "12px", marginBottom: "20px" }}>
            <p style={{ margin: "0 0 12px", color: "#F7931A", fontWeight: 600 }}>Human approval required</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => handleResume(true)} disabled={loading} style={{ flex: 1 }}>
                Approve
              </button>
              <button className="ghost-button" onClick={() => handleResume(false)} disabled={loading} style={{ flex: 1 }}>
                Reject
              </button>
            </div>
          </div>
        )}

        {error ? <p style={{ color: "#ff9f8a", fontSize: "0.85rem" }}>{error}</p> : null}

        {run && (
          <div style={{ marginBottom: "20px", padding: "16px", background: "var(--surface-card)", borderRadius: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{run.id}</span>
              <span style={{
                padding: "2px 10px",
                borderRadius: "999px",
                fontSize: "0.75rem",
                background: isCompleted ? "rgba(16,185,129,0.2)" : isFailed ? "rgba(239,68,68,0.2)" : isInterrupted ? "rgba(247,147,26,0.2)" : "rgba(255,255,255,0.1)",
                color: isCompleted ? "#10b981" : isFailed ? "#ef4444" : isInterrupted ? "#F7931A" : "var(--text-muted)",
              }}>
                {run.status}
              </span>
            </div>
            {run.summary && <p style={{ color: "var(--text-primary)", fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{run.summary}</p>}
            {run.errorMessage && <p style={{ color: "#ef4444", fontSize: "0.85rem" }}>{run.errorMessage}</p>}
          </div>
        )}

        <details>
          <summary style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Event Timeline ({events.length})
          </summary>
          <pre style={{ maxHeight: "200px", overflow: "auto", marginTop: "8px", fontSize: "0.75rem" }}>
            {events.length ? JSON.stringify(events, null, 2) : "No events yet"}
          </pre>
        </details>
      </div>
    </div>
  );
}
