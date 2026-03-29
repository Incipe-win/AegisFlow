package runtime

import (
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	OpenAIBaseURL  string
	OpenAIAPIKey   string
	ChatModel      string
	EmbeddingModel string

	MilvusAddr     string
	MilvusUsername string
	MilvusPassword string
	CollectionName string

	MCPSSEURL string
}

func LoadConfig() Config {
	cfg := Config{
		ChatModel:      "gpt-4.1-mini",
		EmbeddingModel: "text-embedding-3-small",
		MilvusAddr:     "127.0.0.1:19530",
		CollectionName: "aegisflow_knowledge",
		MCPSSEURL:      "http://127.0.0.1:8090/sse",
	}

	loadFromFile(filepath.Join("manifest", "config", "runtime.yaml"), &cfg)
	loadFromFile(filepath.Join("manifest", "config", "runtime.local.yaml"), &cfg)

	cfg.OpenAIBaseURL = envOr("AEGISFLOW_OPENAI_BASE_URL", cfg.OpenAIBaseURL)
	cfg.OpenAIAPIKey = envOr("AEGISFLOW_OPENAI_API_KEY", cfg.OpenAIAPIKey)
	cfg.ChatModel = envOr("AEGISFLOW_CHAT_MODEL", cfg.ChatModel)
	cfg.EmbeddingModel = envOr("AEGISFLOW_EMBEDDING_MODEL", cfg.EmbeddingModel)
	cfg.MilvusAddr = envOr("AEGISFLOW_MILVUS_ADDR", cfg.MilvusAddr)
	cfg.MilvusUsername = envOr("AEGISFLOW_MILVUS_USERNAME", cfg.MilvusUsername)
	cfg.MilvusPassword = envOr("AEGISFLOW_MILVUS_PASSWORD", cfg.MilvusPassword)
	cfg.CollectionName = envOr("AEGISFLOW_MILVUS_COLLECTION", cfg.CollectionName)
	cfg.MCPSSEURL = envOr("AEGISFLOW_MCP_SSE_URL", cfg.MCPSSEURL)

	return cfg
}

func (c Config) HasModelAccess() bool {
	return c.OpenAIAPIKey != ""
}

func envOr(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

type fileConfig struct {
	Runtime struct {
		OpenAI struct {
			BaseURL        string `yaml:"baseUrl"`
			APIKey         string `yaml:"apiKey"`
			ChatModel      string `yaml:"chatModel"`
			EmbeddingModel string `yaml:"embeddingModel"`
		} `yaml:"openai"`
		Milvus struct {
			Addr       string `yaml:"addr"`
			Username   string `yaml:"username"`
			Password   string `yaml:"password"`
			Collection string `yaml:"collection"`
		} `yaml:"milvus"`
		MCP struct {
			SSEURL string `yaml:"sseUrl"`
		} `yaml:"mcp"`
	} `yaml:"runtime"`
}

func loadFromFile(path string, cfg *Config) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return
	}
	var parsed fileConfig
	if err := yaml.Unmarshal(bytes, &parsed); err != nil {
		return
	}

	cfg.OpenAIBaseURL = firstNonEmpty(parsed.Runtime.OpenAI.BaseURL, cfg.OpenAIBaseURL)
	cfg.OpenAIAPIKey = firstNonEmpty(parsed.Runtime.OpenAI.APIKey, cfg.OpenAIAPIKey)
	cfg.ChatModel = firstNonEmpty(parsed.Runtime.OpenAI.ChatModel, cfg.ChatModel)
	cfg.EmbeddingModel = firstNonEmpty(parsed.Runtime.OpenAI.EmbeddingModel, cfg.EmbeddingModel)
	cfg.MilvusAddr = firstNonEmpty(parsed.Runtime.Milvus.Addr, cfg.MilvusAddr)
	cfg.MilvusUsername = firstNonEmpty(parsed.Runtime.Milvus.Username, cfg.MilvusUsername)
	cfg.MilvusPassword = firstNonEmpty(parsed.Runtime.Milvus.Password, cfg.MilvusPassword)
	cfg.CollectionName = firstNonEmpty(parsed.Runtime.Milvus.Collection, cfg.CollectionName)
	cfg.MCPSSEURL = firstNonEmpty(parsed.Runtime.MCP.SSEURL, cfg.MCPSSEURL)
}

func firstNonEmpty(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}
