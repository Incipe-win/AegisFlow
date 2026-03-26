import { useState } from "react";

import { getRunDetail, postDiagnose, type DiagnoseResponse, type RunDetailResponse } from "../api/client";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { formatDate } from "../lib/format";

export function OpsPage() {
  const [form, setForm] = useState<{
    alertTitle: string;
    serviceName: string;
    severity: "critical" | "warning" | "info";
    summary: string;
    sessionId: string;
  }>({
    alertTitle: "payment-service cpu usage high",
    serviceName: "payment-service",
    severity: "critical" as const,
    summary: "支付服务 CPU 连续 5 分钟高于 90%，错误率上升。",
    sessionId: "ops-session-001",
  });
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDiagnose() {
    setLoading(true);
    setError(null);
    try {
      const diagnoseResult = await postDiagnose(form);
      setResult(diagnoseResult);
      const detailResult = await getRunDetail(diagnoseResult.data.runId);
      setRunDetail(detailResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "诊断失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-grid">
      <SectionCard
        title="告警诊断"
        description="输入告警上下文后，后端会检索知识库、调用工具并生成诊断建议。"
      >
        <div className="form-grid">
          <label>
            告警标题
            <input
              value={form.alertTitle}
              onChange={(event) =>
                setForm((current) => ({ ...current, alertTitle: event.target.value }))
              }
            />
          </label>
          <label>
            服务名
            <input
              value={form.serviceName}
              onChange={(event) =>
                setForm((current) => ({ ...current, serviceName: event.target.value }))
              }
            />
          </label>
          <label>
            严重级别
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
            摘要
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
          <button type="button" onClick={handleDiagnose} disabled={loading}>
            {loading ? "诊断中..." : "执行 AI 运维诊断"}
          </button>
          <StatusPill tone="warning">Mock tools + Knowledge retrieval</StatusPill>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </SectionCard>

      <SectionCard
        title="诊断结果"
        description="展示最终结论、执行步骤、知识召回片段和工具调用结果。"
      >
        {result ? (
          <div className="result-block">
            <p className="answer-text">{result.data.result}</p>
            <div className="list-block">
              <h3>执行步骤</h3>
              <ol className="ordered-list">
                {result.data.detail.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="list-block">
              <h3>工具调用</h3>
              {result.data.toolCalls.map((toolCall) => (
                <article key={toolCall.name} className="reference-card">
                  <div className="result-header">
                    <strong>{toolCall.name}</strong>
                    <StatusPill tone="success">{toolCall.status}</StatusPill>
                  </div>
                  <p>Input: {toolCall.input}</p>
                  <p>Output: {toolCall.output}</p>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="hint-line">执行诊断后，这里会展示完整排障建议。</p>
        )}
      </SectionCard>

      <SectionCard
        title="运行记录"
        description="展示运行详情接口返回的数据，便于后续扩展历史列表或审计视图。"
      >
        {runDetail ? (
          <div className="result-block">
            <div className="result-header">
              <h3>{runDetail.data.runId}</h3>
              <StatusPill tone="success">{runDetail.data.status}</StatusPill>
            </div>
            <p className="hint-line">
              运行时间：{formatDate(runDetail.data.createdAt)}
            </p>
            <pre>{JSON.stringify(runDetail, null, 2)}</pre>
          </div>
        ) : (
          <p className="hint-line">本次诊断完成后，会自动查询并展示运行详情。</p>
        )}
      </SectionCard>
    </div>
  );
}
