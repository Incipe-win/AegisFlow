package agent

import (
	"fmt"
	"strings"

	"aegisflow-api/internal/model"
)

type OpsAgent struct{}

func NewOpsAgent() *OpsAgent {
	return &OpsAgent{}
}

func (a *OpsAgent) Diagnose(req model.DiagnoseRequest, refs []model.Reference, toolCalls []model.ToolCallRecord) (string, []string) {
	detail := []string{
		fmt.Sprintf("解析告警上下文：服务=%s，级别=%s。", req.ServiceName, req.Severity),
		"从知识库中检索相关运行手册和历史经验。",
		"调用监控、日志和数据库工具收集现场信息。",
		"综合工具结果和知识库内容，生成诊断建议。",
	}

	keyFindings := make([]string, 0, len(toolCalls))
	for _, call := range toolCalls {
		keyFindings = append(keyFindings, call.Output)
	}

	contextHint := "当前没有命中高相关知识文档。"
	if len(refs) > 0 {
		contextHint = fmt.Sprintf("参考知识库《%s》的建议。", refs[0].Title)
	}

	result := fmt.Sprintf(
		"%s 基于告警“%s”，初步判断 %s 存在需要优先处理的异常。工具结果显示：%s。建议先按运行手册执行限流、日志核查和慢查询确认，如异常持续再升级人工介入。",
		contextHint,
		req.AlertTitle,
		req.ServiceName,
		strings.Join(keyFindings, "；"),
	)
	return result, detail
}
