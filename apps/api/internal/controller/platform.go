package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"aegisflow-api/internal/model"
	"aegisflow-api/internal/platform"

	"github.com/gogf/gf/v2/net/ghttp"
)

type PlatformController struct {
	service *platform.Service
}

func RegisterPlatformRoutes(server *ghttp.Server, service *platform.Service) {
	handler := &PlatformController{service: service}
	server.Group("/api/v2", func(group *ghttp.RouterGroup) {
		group.POST("/sessions", handler.CreateSession)
		group.POST("/runs/chat", handler.RunChat)
		group.POST("/runs/chat/stream", handler.RunChatStream)
		group.POST("/runs/ops", handler.RunOps)
		group.GET("/runs/{runId}", handler.GetRun)
		group.GET("/runs/{runId}/events", handler.GetRunEvents)
		group.POST("/runs/{runId}/resume", handler.ResumeRun)
		group.POST("/knowledge/documents", handler.UploadDocument)
		group.POST("/knowledge/index-jobs", handler.CreateIndexJob)
		group.GET("/tools/mcp", handler.ListMCPTools)
	})
}

func (h *PlatformController) CreateSession(r *ghttp.Request) {
	var req model.CreateSessionRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, err)
		return
	}
	session, err := h.service.CreateSession(r.Context(), req)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIDataResponse[model.Session]{Message: "OK", Data: session})
}

func (h *PlatformController) RunChat(r *ghttp.Request) {
	var req model.ChatRunRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, err)
		return
	}
	run, err := h.service.RunChat(r.Context(), req, nil)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIRunResponse{Message: "OK", Data: run})
}

func (h *PlatformController) RunChatStream(r *ghttp.Request) {
	var req model.ChatRunRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, err)
		return
	}

	r.Response.Header().Set("Content-Type", "text/event-stream")
	r.Response.Header().Set("Cache-Control", "no-cache")
	r.Response.Header().Set("Connection", "keep-alive")
	r.Response.Header().Set("X-Accel-Buffering", "no")

	run, err := h.service.RunChat(r.Context(), req, func(event model.RunEvent) {
		writeSSEJSON(r, "run_event", event)
	})
	if err != nil {
		writeSSEJSON(r, "error", map[string]any{"message": err.Error()})
		return
	}
	writeSSEJSON(r, "done", run)
}

func (h *PlatformController) RunOps(r *ghttp.Request) {
	var req model.OpsRunRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, err)
		return
	}
	run, err := h.service.RunOps(r.Context(), req, nil)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIRunResponse{Message: "OK", Data: run})
}

func (h *PlatformController) GetRun(r *ghttp.Request) {
	runID := r.Get("runId").String()
	run, err := h.service.GetRun(r.Context(), runID)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	if run == nil {
		writeError(r, http.StatusNotFound, fmt.Errorf("run not found"))
		return
	}
	r.Response.WriteJson(model.APIRunResponse{Message: "OK", Data: *run})
}

func (h *PlatformController) GetRunEvents(r *ghttp.Request) {
	runID := r.Get("runId").String()
	events, err := h.service.ListRunEvents(r.Context(), runID)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIListResponse[model.RunEvent]{Message: "OK", Data: events})
}

func (h *PlatformController) ResumeRun(r *ghttp.Request) {
	runID := r.Get("runId").String()
	var req model.ResumeRunRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, err)
		return
	}
	run, err := h.service.ResumeRun(r.Context(), runID, req, nil)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIRunResponse{Message: "OK", Data: run})
}

func (h *PlatformController) UploadDocument(r *ghttp.Request) {
	files := r.GetUploadFiles("file")
	if len(files) == 0 {
		writeError(r, http.StatusBadRequest, fmt.Errorf("missing file field"))
		return
	}
	if err := os.MkdirAll("resource/uploads", 0o755); err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	names, err := files.Save("resource/uploads/")
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	savedPath := filepath.ToSlash(filepath.Join("resource/uploads", names[0]))
	info, err := os.Stat(savedPath)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	doc, err := h.service.UploadKnowledgeDocument(r.Context(), filepath.Base(savedPath), files[0].Header.Get("Content-Type"), savedPath, info.Size())
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIDataResponse[model.KnowledgeDocument]{Message: "OK", Data: doc})
}

func (h *PlatformController) CreateIndexJob(r *ghttp.Request) {
	var req model.CreateKnowledgeIndexJobRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, err)
		return
	}
	job, err := h.service.CreateKnowledgeIndexJob(r.Context(), req)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIDataResponse[model.KnowledgeIndexJob]{Message: "OK", Data: job})
}

func (h *PlatformController) ListMCPTools(r *ghttp.Request) {
	tools, err := h.service.ListMCPTools(r.Context())
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIListResponse[model.MCPToolDescriptor]{Message: "OK", Data: tools})
}

func writeSSEJSON(r *ghttp.Request, event string, value any) {
	bytes, _ := json.Marshal(value)
	r.Response.Writef("id: %d\n", time.Now().UnixMilli())
	r.Response.Writef("event: %s\n", event)
	r.Response.Writef("data: %s\n\n", string(bytes))
	r.Response.Flush()
}
