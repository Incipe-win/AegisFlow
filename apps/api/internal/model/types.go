package model

import "time"

type APIResponse[T any] struct {
	Message string `json:"message"`
	Data    T      `json:"data,omitempty"`
}

type ErrorResponse struct {
	Message string `json:"message"`
	Error   string `json:"error"`
}

type ChatRequest struct {
	SessionID string `json:"sessionId"`
	Question  string `json:"question"`
	TopK      int    `json:"topK"`
}

type ChatResponseData struct {
	SessionID   string      `json:"sessionId"`
	Answer      string      `json:"answer"`
	References  []Reference `json:"references"`
	Suggestions []string    `json:"suggestions"`
}

type DiagnoseRequest struct {
	AlertTitle  string `json:"alertTitle"`
	ServiceName string `json:"serviceName"`
	Severity    string `json:"severity"`
	Summary     string `json:"summary"`
	SessionID   string `json:"sessionId"`
}

type DiagnoseResponseData struct {
	RunID      string           `json:"runId"`
	Result     string           `json:"result"`
	Detail     []string         `json:"detail"`
	References []Reference      `json:"references"`
	ToolCalls  []ToolCallRecord `json:"toolCalls"`
}

type UploadFileResponseData struct {
	DocumentID string `json:"documentId"`
	FileName   string `json:"fileName"`
	FilePath   string `json:"filePath"`
	FileSize   int64  `json:"fileSize"`
	Status     string `json:"status"`
}

type KnowledgeIndexRequest struct {
	DocumentIDs []string `json:"documentIds"`
	ChunkSize   int      `json:"chunkSize"`
	Overlap     int      `json:"overlap"`
	TopK        int      `json:"topK"`
}

type KnowledgeIndexResponseData struct {
	IndexedDocuments int `json:"indexedDocuments"`
	IndexedChunks    int `json:"indexedChunks"`
	ChunkSize        int `json:"chunkSize"`
	Overlap          int `json:"overlap"`
	TopK             int `json:"topK"`
}

type Reference struct {
	DocumentID string  `json:"documentId"`
	Title      string  `json:"title"`
	Excerpt    string  `json:"excerpt"`
	Score      float64 `json:"score"`
}

type ToolCallRecord struct {
	Name   string `json:"name"`
	Input  string `json:"input"`
	Output string `json:"output"`
	Status string `json:"status"`
}

type RunDetailData struct {
	RunID      string           `json:"runId"`
	RunType    string           `json:"runType"`
	Status     string           `json:"status"`
	Summary    string           `json:"summary"`
	Detail     []string         `json:"detail"`
	References []Reference      `json:"references"`
	ToolCalls  []ToolCallRecord `json:"toolCalls"`
	CreatedAt  time.Time        `json:"createdAt"`
}

type DocumentRecord struct {
	ID         string     `orm:"id" json:"id"`
	Title      string     `orm:"title" json:"title"`
	SourceType string     `orm:"source_type" json:"sourceType"`
	FilePath   string     `orm:"file_path" json:"filePath"`
	FileSize   int64      `orm:"file_size" json:"fileSize"`
	Status     string     `orm:"status" json:"status"`
	Content    string     `orm:"content" json:"content"`
	IndexedAt  *time.Time `orm:"indexed_at" json:"indexedAt"`
	CreatedAt  time.Time  `orm:"created_at" json:"createdAt"`
	UpdatedAt  time.Time  `orm:"updated_at" json:"updatedAt"`
}

type DocumentChunkRecord struct {
	ID         string    `orm:"id"`
	DocumentID string    `orm:"document_id"`
	Position   int       `orm:"position"`
	Content    string    `orm:"content"`
	CreatedAt  time.Time `orm:"created_at"`
}

type DocumentChunkView struct {
	DocumentID string `orm:"document_id"`
	Title      string `orm:"title"`
	Content    string `orm:"content"`
}

type ChatMessageRecord struct {
	ID        string    `orm:"id"`
	SessionID string    `orm:"session_id"`
	Role      string    `orm:"role"`
	Content   string    `orm:"content"`
	CreatedAt time.Time `orm:"created_at"`
}

type RunRecord struct {
	ID             string    `orm:"id"`
	RunType        string    `orm:"run_type"`
	Status         string    `orm:"status"`
	Summary        string    `orm:"summary"`
	DetailJSON     string    `orm:"detail_json"`
	ReferencesJSON string    `orm:"references_json"`
	ToolCallsJSON  string    `orm:"tool_calls_json"`
	CreatedAt      time.Time `orm:"created_at"`
}
