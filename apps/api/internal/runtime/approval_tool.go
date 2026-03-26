package runtime

import (
	"context"
	"fmt"

	einotool "github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
)

type ApprovalInterruptInfo struct {
	ToolName        string `json:"toolName"`
	ArgumentsInJSON string `json:"argumentsInJson"`
	ToolCallID      string `json:"toolCallId"`
}

type ApprovalResumeData struct {
	Approved bool   `json:"approved"`
	Note     string `json:"note,omitempty"`
}

type ApprovalTool struct {
	name string
}

func NewApprovalTool() *ApprovalTool {
	return &ApprovalTool{name: "approval.request"}
}

func (t *ApprovalTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: t.name,
		Desc: "Request human approval before finalizing a risky operational action",
		ParamsOneOf: schema.NewParamsOneOfByParams(map[string]*schema.ParameterInfo{
			"summary": {
				Type:     schema.String,
				Required: true,
				Desc:     "Concise summary for the human approver",
			},
		}),
	}, nil
}

func (t *ApprovalTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...einotool.Option) (string, error) {
	wasInterrupted, _, storedArguments := einotool.GetInterruptState[string](ctx)
	if !wasInterrupted {
		return "", einotool.StatefulInterrupt(ctx, &ApprovalInterruptInfo{
			ToolName:        t.name,
			ArgumentsInJSON: argumentsInJSON,
			ToolCallID:      compose.GetToolCallID(ctx),
		}, argumentsInJSON)
	}

	isResumeTarget, hasData, data := einotool.GetResumeContext[*ApprovalResumeData](ctx)
	if !isResumeTarget {
		return "", einotool.StatefulInterrupt(ctx, &ApprovalInterruptInfo{
			ToolName:        t.name,
			ArgumentsInJSON: storedArguments,
			ToolCallID:      compose.GetToolCallID(ctx),
		}, storedArguments)
	}
	if !hasData {
		return "", fmt.Errorf("approval resume data missing")
	}
	if !data.Approved {
		note := data.Note
		if note == "" {
			note = "human approver rejected the proposed action"
		}
		return fmt.Sprintf("approval denied: %s", note), nil
	}
	return fmt.Sprintf("approval granted: %s", data.Note), nil
}
