package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"aegisflow-api/internal/model"
	"aegisflow-api/internal/service"

	"github.com/gogf/gf/v2/net/ghttp"
)

type HTTPController struct {
	app *service.App
}

func RegisterRoutes(server *ghttp.Server, app *service.App) {
	handler := &HTTPController{app: app}
	server.Group("/api/v1", func(group *ghttp.RouterGroup) {
		group.POST("/chat", handler.Chat)
		group.POST("/chat/stream", handler.ChatStream)
		group.POST("/ops/diagnose", handler.Diagnose)
		group.POST("/knowledge/files", handler.UploadKnowledgeFile)
		group.POST("/knowledge/index", handler.IndexKnowledge)
		group.GET("/runs/{runId}", handler.GetRunDetail)
	})
}

func (h *HTTPController) Chat(r *ghttp.Request) {
	var req model.ChatRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, err)
		return
	}
	data, _, _, err := h.app.Chat(r.Context(), req)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIResponse[model.ChatResponseData]{
		Message: "OK",
		Data:    data,
	})
}

func (h *HTTPController) ChatStream(r *ghttp.Request) {
	var req model.ChatRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, err)
		return
	}

	data, _, _, err := h.app.Chat(r.Context(), req)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}

	r.Response.Header().Set("Content-Type", "text/event-stream")
	r.Response.Header().Set("Cache-Control", "no-cache")
	r.Response.Header().Set("Connection", "keep-alive")
	r.Response.Header().Set("X-Accel-Buffering", "no")

	writeSSE(r, "connected", fmt.Sprintf(`{"status":"connected","sessionId":%q}`, data.SessionID))
	for _, part := range service.SplitForStream(data.Answer, 26) {
		writeSSE(r, "message", part)
	}
	for _, ref := range data.References {
		writeSSE(r, "reference", service.BuildReferenceEvent(ref))
	}
	writeSSE(r, "done", `{"status":"completed"}`)
}

func (h *HTTPController) Diagnose(r *ghttp.Request) {
	var req model.DiagnoseRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, err)
		return
	}
	data, err := h.app.Diagnose(r.Context(), req)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIResponse[model.DiagnoseResponseData]{
		Message: "OK",
		Data:    data,
	})
}

func (h *HTTPController) UploadKnowledgeFile(r *ghttp.Request) {
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
	data, err := h.app.UploadDocument(r.Context(), filepath.Base(savedPath), savedPath, info.Size())
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIResponse[model.UploadFileResponseData]{
		Message: "OK",
		Data:    data,
	})
}

func (h *HTTPController) IndexKnowledge(r *ghttp.Request) {
	var req model.KnowledgeIndexRequest
	if err := r.Parse(&req); err != nil {
		writeError(r, http.StatusBadRequest, err)
		return
	}
	data, err := h.app.IndexKnowledge(r.Context(), req)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	r.Response.WriteJson(model.APIResponse[model.KnowledgeIndexResponseData]{
		Message: "OK",
		Data:    data,
	})
}

func (h *HTTPController) GetRunDetail(r *ghttp.Request) {
	runID := r.Get("runId").String()
	if runID == "" {
		writeError(r, http.StatusBadRequest, fmt.Errorf("missing runId"))
		return
	}
	data, err := h.app.GetRunDetail(context.Background(), runID)
	if err != nil {
		writeError(r, http.StatusInternalServerError, err)
		return
	}
	if data == nil {
		writeError(r, http.StatusNotFound, fmt.Errorf("run not found"))
		return
	}
	r.Response.WriteJson(model.APIResponse[model.RunDetailData]{
		Message: "OK",
		Data:    *data,
	})
}

func writeError(r *ghttp.Request, status int, err error) {
	r.Response.WriteHeader(status)
	r.Response.WriteJson(model.ErrorResponse{
		Message: "ERROR",
		Error:   err.Error(),
	})
}

func writeSSE(r *ghttp.Request, event string, data string) {
	if json.Valid([]byte(data)) {
		r.Response.Writef("id: %d\n", time.Now().UnixMilli())
		r.Response.Writef("event: %s\n", event)
		r.Response.Writef("data: %s\n\n", data)
	} else {
		payload, _ := json.Marshal(data)
		r.Response.Writef("id: %d\n", time.Now().UnixMilli())
		r.Response.Writef("event: %s\n", event)
		r.Response.Writef("data: %s\n\n", payload)
	}
	r.Response.Flush()
}
