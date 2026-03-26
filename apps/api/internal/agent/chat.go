package agent

import (
	"fmt"
	"strings"

	"aegisflow-api/internal/model"
)

type ChatAgent struct{}

func NewChatAgent() *ChatAgent {
	return &ChatAgent{}
}

func (a *ChatAgent) Respond(question string, history []model.ChatMessageRecord, refs []model.Reference) (string, []string, []string) {
	detail := []string{
		"读取最近会话上下文，保持多轮对话记忆。",
		"从知识库中检索相关文档片段，组织高相关内容。",
		"按问答场景生成建议与下一步行动项。",
	}

	var historyHint string
	if len(history) > 0 {
		last := history[len(history)-1]
		historyHint = fmt.Sprintf("上一轮你提到：%s。", trimRunes(last.Content, 28))
	}

	if len(refs) == 0 {
		answer := strings.TrimSpace(historyHint + " 当前知识库没有直接命中的资料，我建议先补充服务名、告警名称、错误日志或最近变更信息，再继续追问。")
		return answer, []string{"补充更多上下文信息", "上传相关故障文档到知识库"}, detail
	}

	snippets := make([]string, 0, len(refs))
	for _, ref := range refs {
		snippets = append(snippets, fmt.Sprintf("《%s》提到：%s", ref.Title, ref.Excerpt))
	}

	answer := fmt.Sprintf(
		"%s针对“%s”，我从知识库里找到了 %d 条高相关内容。%s 综合来看，建议先按知识库中的排障顺序检查服务状态、核心日志和最近变更，再根据异常指标决定是否升级为自动诊断。",
		historyHint,
		question,
		len(refs),
		strings.Join(snippets, "；"),
	)
	answer = strings.TrimSpace(answer)

	suggestions := []string{
		"继续追问更细的排障步骤",
		"切换到 AI 运维诊断页面执行自动分析",
	}
	return answer, suggestions, detail
}

func trimRunes(text string, size int) string {
	runes := []rune(strings.TrimSpace(text))
	if len(runes) <= size {
		return string(runes)
	}
	return string(runes[:size]) + "..."
}
