package main

import (
	"context"
	"os"
	"path/filepath"
	"strconv"

	_ "github.com/gogf/gf/contrib/drivers/mysql/v2"
	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/net/ghttp"

	"aegisflow-api/internal/controller"
	"aegisflow-api/internal/platform"
	"aegisflow-api/internal/repository"
	"aegisflow-api/internal/runtime"
	"aegisflow-api/internal/store"
)

func main() {
	ensureLocalConfigOverride()

	ctx := context.Background()
	repo := repository.New(g.DB())
	uploadDir := envOr("AEGISFLOW_UPLOAD_DIR", "resource/uploads")
	seedDir := envOr("AEGISFLOW_SEED_DIR", "resource/seed")

	if err := store.Bootstrap(ctx, repo, seedDir, uploadDir); err != nil {
		panic(err)
	}
	if err := store.EnsurePlatformSchema(ctx, repo, seedDir); err != nil {
		panic(err)
	}

	server := g.Server()
	server.SetPort(envOrInt("AEGISFLOW_API_PORT", 6872))
	server.BindMiddlewareDefault(func(r *ghttp.Request) {
		r.Response.CORSDefault()
		r.Response.Header().Set("Access-Control-Expose-Headers", "Content-Type")
		r.Middleware.Next()
	})

	runtimeConfig := runtime.LoadConfig()
	platformService := platform.NewService(repo, runtime.NewDependencies(runtimeConfig, repo), uploadDir)
	controller.RegisterPlatformRoutes(server, platformService)
	server.Run()
}

func ensureLocalConfigOverride() {
	if os.Getenv("GF_GCFG_FILE") != "" {
		return
	}

	const localConfigName = "config.local.yaml"
	if _, err := os.Stat(filepath.Join("manifest", "config", localConfigName)); err == nil {
		_ = os.Setenv("GF_GCFG_FILE", localConfigName)
	}
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
