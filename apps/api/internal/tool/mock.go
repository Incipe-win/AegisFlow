package tool

import (
	"context"
	"fmt"
	"strings"

	"aegisflow-api/internal/model"
)

type Provider interface {
	Diagnose(ctx context.Context, req model.DiagnoseRequest) ([]model.ToolCallRecord, error)
}

type MockProvider struct{}

func NewMockProvider() *MockProvider {
	return &MockProvider{}
}

func (p *MockProvider) Diagnose(ctx context.Context, req model.DiagnoseRequest) ([]model.ToolCallRecord, error) {
	service := req.ServiceName
	if service == "" {
		service = "unknown-service"
	}

	cpuSignal := "5m avg=72%, errorRate=1.1%, traffic +6%"
	logSignal := "timeout=4, slow_query=1, panic=0"
	mysqlSignal := "slow SQL top1 duration=420ms"

	if containsAny(req.AlertTitle+" "+req.Summary, "cpu", "CPU", "延迟", "timeout", "错误率", "error") {
		cpuSignal = "5m avg=93%, errorRate=4.8%, traffic +22%"
		logSignal = "timeout=16, slow_query=6, downstream retry=8"
		mysqlSignal = "slow SQL top1 duration=1280ms, rows=12034"
	}

	return []model.ToolCallRecord{
		{
			Name:   "prometheus.query",
			Input:  fmt.Sprintf("cpu_usage{service=\"%s\"}", service),
			Output: cpuSignal,
			Status: "success",
		},
		{
			Name:   "logs.query",
			Input:  fmt.Sprintf("service:%s level:error OR timeout", service),
			Output: logSignal,
			Status: "success",
		},
		{
			Name:   "mysql.query",
			Input:  fmt.Sprintf("SHOW SLOW QUERY SUMMARY FOR %s", service),
			Output: mysqlSignal,
			Status: "success",
		},
		{
			Name:   "web.search",
			Input:  fmt.Sprintf("runbook %s oncall", service),
			Output: "内部 runbook 与近期工单摘要已匹配到相似案例。",
			Status: "success",
		},
	}, nil
}

func containsAny(text string, terms ...string) bool {
	for _, term := range terms {
		if strings.Contains(text, term) {
			return true
		}
	}
	return false
}
