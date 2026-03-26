package main

import (
	"context"
	"os"
	"strconv"

	_ "github.com/gogf/gf/contrib/drivers/mysql/v2"
	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/net/ghttp"

	"aegisflow-api/internal/agent"
	"aegisflow-api/internal/controller"
	"aegisflow-api/internal/model"
	"aegisflow-api/internal/repository"
	"aegisflow-api/internal/service"
	"aegisflow-api/internal/store"
	"aegisflow-api/internal/tool"
)

func main() {
	ctx := context.Background()
	repo := repository.New(g.DB())
	uploadDir := envOr("AEGISFLOW_UPLOAD_DIR", "resource/uploads")
	seedDir := envOr("AEGISFLOW_SEED_DIR", "resource/seed")

	if err := store.Bootstrap(ctx, repo, seedDir, uploadDir); err != nil {
		panic(err)
	}

	app := service.NewApp(
		repo,
		agent.NewRetriever(repo),
		agent.NewChatAgent(),
		agent.NewOpsAgent(),
		tool.NewMockProvider(),
		uploadDir,
	)

	if _, err := app.IndexKnowledge(ctx, model.KnowledgeIndexRequest{}); err != nil {
		g.Log().Warningf(ctx, "initial knowledge indexing failed: %+v", err)
	}

	server := g.Server()
	server.SetPort(envOrInt("AEGISFLOW_API_PORT", 6872))
	server.BindMiddlewareDefault(func(r *ghttp.Request) {
		r.Response.CORSDefault()
		r.Response.Header().Set("Access-Control-Expose-Headers", "Content-Type")
		r.Middleware.Next()
	})

	controller.RegisterRoutes(server, app)
	server.Run()
}

func envOr(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envOrInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return fallback
}
