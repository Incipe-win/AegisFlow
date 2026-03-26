package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"aegisflow-api/internal/model"

	"github.com/cloudwego/eino/adk"
	"github.com/cloudwego/eino/adk/prebuilt/planexecute"
	"github.com/cloudwego/eino/adk/prebuilt/supervisor"
	einotool "github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"github.com/google/uuid"
)

type RunExecution struct {
	Run           model.Run
	Events        []model.RunEvent
	AssistantText string
	Interrupted   *model.InterruptData
	HasError      bool
}

func (d *Dependencies) NewChatRunner(ctx context.Context, refs []model.ReferenceChunk, topK int) (*adk.Runner, func() error, error) {
	chatModel, err := d.NewChatModel(ctx)
	if err != nil {
		return nil, nil, err
	}
	mcpTools, closeFn, err := d.NewMCPTools(ctx, []string{
		"runbook.search",
		"prometheus.query",
		"logs.search",
		"mysql.query",
	})
	if err != nil {
		return nil, nil, err
	}

	instruction := strings.TrimSpace(`You are AegisFlowChatAgent, a production oncall assistant.
Use tools when they help answer the user's question accurately.
Prefer runbook.search for internal knowledge. If operational context suggests live diagnosis, use prometheus.query, logs.search, or mysql.query.
When you answer, cite the most relevant runbook snippets in plain language and keep the answer actionable.` + "\n\n" + renderReferenceContext(refs))

	agent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
		Name:        "AegisFlowChatAgent",
		Description: "ReAct chat agent for internal Q&A and operational consultation",
		Instruction: instruction,
		Model:       chatModel,
		ToolsConfig: adk.ToolsConfig{
			ToolsNodeConfig: composeToolsConfig(mcpTools),
		},
		MaxIterations: 8,
	})
	if err != nil {
		closeFn()
		return nil, nil, err
	}

	runner := adk.NewRunner(ctx, adk.RunnerConfig{
		Agent:           agent,
		EnableStreaming: true,
		CheckPointStore: d.checkpoints,
	})
	return runner, closeFn, nil
}

func (d *Dependencies) NewOpsRunner(ctx context.Context, req model.OpsRunRequest, refs []model.ReferenceChunk) (*adk.Runner, func() error, error) {
	chatModel, err := d.NewChatModel(ctx)
	if err != nil {
		return nil, nil, err
	}
	mcpTools, closeFn, err := d.NewMCPTools(ctx, []string{
		"runbook.search",
		"prometheus.query",
		"logs.search",
		"mysql.query",
	})
	if err != nil {
		return nil, nil, err
	}
	approvalTool := NewApprovalTool()

	runbookAgent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
		Name:          "RunbookRetrieverAgent",
		Description:   "Collects internal runbook and knowledge context for the current incident",
		Instruction:   "Use runbook.search to retrieve the most relevant runbook snippets, then summarize the operational context for the rest of the team.",
		Model:         chatModel,
		ToolsConfig:   adk.ToolsConfig{ToolsNodeConfig: composeToolsConfig(filterTools(mcpTools, "runbook.search"))},
		MaxIterations: 5,
	})
	if err != nil {
		closeFn()
		return nil, nil, err
	}

	planner, err := planexecute.NewPlanner(ctx, &planexecute.PlannerConfig{
		ToolCallingChatModel: chatModel,
	})
	if err != nil {
		closeFn()
		return nil, nil, err
	}
	executor, err := planexecute.NewExecutor(ctx, &planexecute.ExecutorConfig{
		Model: chatModel,
		ToolsConfig: adk.ToolsConfig{
			ToolsNodeConfig: composeToolsConfig(append(mcpTools, approvalTool)),
		},
		MaxIterations: 8,
	})
	if err != nil {
		closeFn()
		return nil, nil, err
	}
	replanner, err := planexecute.NewReplanner(ctx, &planexecute.ReplannerConfig{
		ChatModel: chatModel,
	})
	if err != nil {
		closeFn()
		return nil, nil, err
	}
	planExecuteAgent, err := planexecute.New(ctx, &planexecute.Config{
		Planner:       planner,
		Executor:      executor,
		Replanner:     replanner,
		MaxIterations: 6,
	})
	if err != nil {
		closeFn()
		return nil, nil, err
	}

	reporterAgent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
		Name:          "ReporterAgent",
		Description:   "Produces the final incident report and requests human approval before risky action summaries",
		Instruction:   "Before you provide a final report for warning or critical incidents, call approval.request with a concise summary for the human approver. After approval, produce the final response including root cause hypothesis, impact, evidence, and next actions.",
		Model:         chatModel,
		ToolsConfig:   adk.ToolsConfig{ToolsNodeConfig: composeToolsConfig([]einotool.BaseTool{approvalTool})},
		MaxIterations: 4,
	})
	if err != nil {
		closeFn()
		return nil, nil, err
	}

	supervisorAgent, err := adk.NewChatModelAgent(ctx, &adk.ChatModelAgentConfig{
		Name:          "OpsSupervisor",
		Description:   "Coordinates multiple specialists to investigate an oncall incident from runbook retrieval to diagnosis to final report",
		Instruction:   buildSupervisorInstruction(req, refs),
		Model:         chatModel,
		MaxIterations: 10,
	})
	if err != nil {
		closeFn()
		return nil, nil, err
	}

	multiAgent, err := supervisor.New(ctx, &supervisor.Config{
		Supervisor: supervisorAgent,
		SubAgents: []adk.Agent{
			runbookAgent,
			planExecuteAgent,
			reporterAgent,
		},
	})
	if err != nil {
		closeFn()
		return nil, nil, err
	}

	runner := adk.NewRunner(ctx, adk.RunnerConfig{
		Agent:           multiAgent,
		EnableStreaming: true,
		CheckPointStore: d.checkpoints,
	})
	return runner, closeFn, nil
}

func (d *Dependencies) ExecuteRun(ctx context.Context, iter *adk.AsyncIterator[*adk.AgentEvent], run *model.Run, persist func(model.RunEvent) error, onStream func(model.RunEvent), onInterrupt func(*model.InterruptData), checkpointID string) (RunExecution, error) {
	result := RunExecution{Run: *run}
	sequence := 0
	var lastAssistant string
	for {
		event, ok := iter.Next()
		if !ok {
			break
		}

		if event.Err != nil {
			ev := newRunEvent(run.ID, sequence, "error", event.AgentName, "", "", event.Err.Error(), nil)
			if err := persist(ev); err != nil {
				return result, err
			}
			result.Events = append(result.Events, ev)
			result.HasError = true
			continue
		}

		if event.Output != nil && event.Output.MessageOutput != nil {
			msgVariant := event.Output.MessageOutput
			if msgVariant.IsStreaming {
				for {
					msg, err := msgVariant.MessageStream.Recv()
					if err == io.EOF {
						break
					}
					if err != nil {
						return result, err
					}
					events := mapMessageToEvents(run.ID, &sequence, event.AgentName, msgVariant.Role, msgVariant.ToolName, msg)
					for _, ev := range events {
						if err := persist(ev); err != nil {
							return result, err
						}
						result.Events = append(result.Events, ev)
						onStream(ev)
						if ev.Role == string(schema.Assistant) && ev.Content != "" {
							lastAssistant += ev.Content
						}
					}
				}
			} else {
				msg, err := msgVariant.GetMessage()
				if err != nil {
					return result, err
				}
				events := mapMessageToEvents(run.ID, &sequence, event.AgentName, msgVariant.Role, msgVariant.ToolName, msg)
				for _, ev := range events {
					if err := persist(ev); err != nil {
						return result, err
					}
					result.Events = append(result.Events, ev)
					onStream(ev)
					if ev.Role == string(schema.Assistant) && ev.Content != "" {
						lastAssistant = ev.Content
					}
				}
			}
		}

		if event.Action != nil {
			if event.Action.TransferToAgent != nil {
				ev := newRunEvent(run.ID, sequence, "transfer", event.AgentName, "", "", "", map[string]any{
					"destination": event.Action.TransferToAgent.DestAgentName,
				})
				if err := persist(ev); err != nil {
					return result, err
				}
				result.Events = append(result.Events, ev)
				onStream(ev)
			}
			if event.Action.Interrupted != nil {
				interrupt := toInterruptData(event.Action.Interrupted.InterruptContexts)
				onInterrupt(interrupt)
				ev := newRunEvent(run.ID, sequence, "interrupted", event.AgentName, "", "", "", interrupt)
				if err := persist(ev); err != nil {
					return result, err
				}
				result.Events = append(result.Events, ev)
				onStream(ev)
				result.Interrupted = interrupt
			}
			if event.Action.BreakLoop != nil {
				ev := newRunEvent(run.ID, sequence, "break_loop", event.AgentName, "", "", "", nil)
				if err := persist(ev); err != nil {
					return result, err
				}
				result.Events = append(result.Events, ev)
				onStream(ev)
			}
		}
	}

	result.AssistantText = strings.TrimSpace(lastAssistant)
	return result, nil
}

func composeToolsConfig(tools []einotool.BaseTool) compose.ToolsNodeConfig {
	return compose.ToolsNodeConfig{
		Tools: tools,
	}
}

func filterTools(tools []einotool.BaseTool, allowed ...string) []einotool.BaseTool {
	set := map[string]struct{}{}
	for _, name := range allowed {
		set[name] = struct{}{}
	}
	filtered := make([]einotool.BaseTool, 0, len(tools))
	for _, candidate := range tools {
		info, err := candidate.Info(context.Background())
		if err != nil {
			continue
		}
		if _, ok := set[info.Name]; ok {
			filtered = append(filtered, candidate)
		}
	}
	return filtered
}

func buildSupervisorInstruction(req model.OpsRunRequest, refs []model.ReferenceChunk) string {
	base := fmt.Sprintf(`You are OpsSupervisor.
You must coordinate specialists in this exact order:
1. transfer to RunbookRetrieverAgent to gather internal knowledge
2. transfer to DiagnosisPlanExecuteAgent to investigate the alert with tools
3. transfer to ReporterAgent to produce the final approved report

Incident context:
- alertTitle: %s
- serviceName: %s
- severity: %s
- summary: %s

Do not answer directly before the three phases are completed.`, req.AlertTitle, req.ServiceName, req.Severity, req.Summary)
	return strings.TrimSpace(base + "\n\n" + renderReferenceContext(refs))
}

func renderReferenceContext(refs []model.ReferenceChunk) string {
	if len(refs) == 0 {
		return "No pre-retrieved runbook context is available."
	}
	parts := make([]string, 0, len(refs))
	for _, ref := range refs {
		parts = append(parts, fmt.Sprintf("[%s] %s", ref.Title, ref.Content))
	}
	return "Pre-retrieved runbook context:\n" + strings.Join(parts, "\n\n")
}

func mapMessageToEvents(runID string, sequence *int, agentName string, role schema.RoleType, toolName string, msg *schema.Message) []model.RunEvent {
	if msg == nil {
		return nil
	}
	events := make([]model.RunEvent, 0, 2)
	if len(msg.ToolCalls) > 0 {
		payload, _ := json.Marshal(msg.ToolCalls)
		events = append(events, newRunEvent(runID, *sequence, "tool_call", agentName, string(role), toolName, msg.Content, json.RawMessage(payload)))
		*sequence = *sequence + 1
	}
	if msg.Content != "" || role == schema.Tool {
		events = append(events, newRunEvent(runID, *sequence, "message", agentName, string(role), toolName, msg.Content, nil))
		*sequence = *sequence + 1
	}
	return events
}

func newRunEvent(runID string, sequence int, eventType, agentName, role, toolName, content string, payload any) model.RunEvent {
	payloadJSON := ""
	if payload != nil {
		if bytes, err := json.Marshal(payload); err == nil {
			payloadJSON = string(bytes)
		}
	}
	return model.RunEvent{
		ID:          "evt-" + uuid.NewString(),
		RunID:       runID,
		Sequence:    sequence,
		EventType:   eventType,
		AgentName:   agentName,
		Role:        role,
		ToolName:    toolName,
		Content:     content,
		PayloadJSON: payloadJSON,
		CreatedAt:   time.Now(),
		Payload:     payload,
	}
}

func toInterruptData(contexts []*adk.InterruptCtx) *model.InterruptData {
	if len(contexts) == 0 {
		return nil
	}
	items := make([]model.InterruptContext, 0, len(contexts))
	for _, item := range contexts {
		if item == nil {
			continue
		}
		items = append(items, model.InterruptContext{
			ID:          item.ID,
			Address:     item.Address.String(),
			Info:        item.Info,
			IsRootCause: item.IsRootCause,
		})
	}
	return &model.InterruptData{Contexts: items}
}
