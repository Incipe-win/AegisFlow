package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/cloudwego/eino/components/embedding"
)

type arkMultimodalEmbedderConfig struct {
	BaseURL string
	APIKey  string
	Model   string
	Timeout time.Duration
}

type arkMultimodalEmbedder struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

type arkMultimodalEmbeddingRequest struct {
	Model string                        `json:"model"`
	Input []arkMultimodalEmbeddingInput `json:"input"`
}

type arkMultimodalEmbeddingInput struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type arkMultimodalEmbeddingResponse struct {
	Data  arkMultimodalEmbeddingData   `json:"data"`
	Error *arkMultimodalEmbeddingError `json:"error,omitempty"`
}

type arkMultimodalEmbeddingData struct {
	Embedding []float64 `json:"embedding"`
}

type arkMultimodalEmbeddingError struct {
	Message string `json:"message"`
	Code    string `json:"code"`
	Type    string `json:"type"`
}

func newArkMultimodalEmbedder(config *arkMultimodalEmbedderConfig) (embedding.Embedder, error) {
	if config == nil {
		return nil, fmt.Errorf("multimodal embedder config is required")
	}
	if strings.TrimSpace(config.BaseURL) == "" || strings.TrimSpace(config.APIKey) == "" || strings.TrimSpace(config.Model) == "" {
		return nil, fmt.Errorf("baseURL, apiKey and model are required for multimodal embedding")
	}
	if !supportsArkMultimodalEmbedding(config.BaseURL, config.Model) {
		return nil, fmt.Errorf("multimodal embedding is only enabled for Ark endpoint models")
	}

	timeout := config.Timeout
	if timeout <= 0 {
		timeout = 60 * time.Second
	}

	return &arkMultimodalEmbedder{
		baseURL:    strings.TrimRight(config.BaseURL, "/"),
		apiKey:     strings.TrimSpace(config.APIKey),
		model:      strings.TrimSpace(config.Model),
		httpClient: &http.Client{Timeout: timeout},
	}, nil
}

func supportsArkMultimodalEmbedding(baseURL string, model string) bool {
	baseURL = strings.ToLower(strings.TrimSpace(baseURL))
	model = strings.TrimSpace(model)
	return strings.HasPrefix(model, "ep-") && (strings.Contains(baseURL, "ark.") || strings.Contains(baseURL, "volces.com"))
}

func (e *arkMultimodalEmbedder) EmbedStrings(ctx context.Context, texts []string, opts ...embedding.Option) ([][]float64, error) {
	embeddings := make([][]float64, 0, len(texts))
	for _, text := range texts {
		vector, err := e.embedText(ctx, text)
		if err != nil {
			return nil, err
		}
		embeddings = append(embeddings, vector)
	}
	return embeddings, nil
}

func (e *arkMultimodalEmbedder) embedText(ctx context.Context, text string) ([]float64, error) {
	body, err := json.Marshal(arkMultimodalEmbeddingRequest{
		Model: e.model,
		Input: []arkMultimodalEmbeddingInput{
			{
				Type: "text",
				Text: text,
			},
		},
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.baseURL+"/embeddings/multimodal", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.apiKey)

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var parsed arkMultimodalEmbeddingResponse
	_ = json.Unmarshal(respBody, &parsed)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if parsed.Error != nil && strings.TrimSpace(parsed.Error.Message) != "" {
			return nil, fmt.Errorf("multimodal embedding request failed: %s", parsed.Error.Message)
		}
		return nil, fmt.Errorf("multimodal embedding request failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	if parsed.Error != nil && strings.TrimSpace(parsed.Error.Message) != "" {
		return nil, fmt.Errorf("multimodal embedding request failed: %s", parsed.Error.Message)
	}
	if len(parsed.Data.Embedding) == 0 {
		return nil, fmt.Errorf("multimodal embedding response is empty")
	}
	return parsed.Data.Embedding, nil
}
