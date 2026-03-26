package runtime

import (
	"os"
	"strings"
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
	return Config{
		OpenAIBaseURL:  strings.TrimSpace(os.Getenv("AEGISFLOW_OPENAI_BASE_URL")),
		OpenAIAPIKey:   strings.TrimSpace(os.Getenv("AEGISFLOW_OPENAI_API_KEY")),
		ChatModel:      orDefault("AEGISFLOW_CHAT_MODEL", "gpt-4.1-mini"),
		EmbeddingModel: orDefault("AEGISFLOW_EMBEDDING_MODEL", "text-embedding-3-small"),
		MilvusAddr:     orDefault("AEGISFLOW_MILVUS_ADDR", "127.0.0.1:19530"),
		MilvusUsername: strings.TrimSpace(os.Getenv("AEGISFLOW_MILVUS_USERNAME")),
		MilvusPassword: strings.TrimSpace(os.Getenv("AEGISFLOW_MILVUS_PASSWORD")),
		CollectionName: orDefault("AEGISFLOW_MILVUS_COLLECTION", "aegisflow_knowledge"),
		MCPSSEURL:      orDefault("AEGISFLOW_MCP_SSE_URL", "http://127.0.0.1:8090/sse"),
	}
}

func (c Config) HasModelAccess() bool {
	return c.OpenAIAPIKey != ""
}

func orDefault(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
