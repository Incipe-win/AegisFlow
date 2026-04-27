package model

import "time"

type ErrorResponse struct {
	Message string `json:"message"`
	Error   string `json:"error"`
}

type Session struct {
	ID        string    `json:"id" orm:"id"`
	Title     string    `json:"title" orm:"title"`
	Mode      string    `json:"mode" orm:"mode"`
	CreatedAt time.Time `json:"createdAt" orm:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" orm:"updated_at"`
}

type Run struct {
	ID            string         `json:"id" orm:"id"`
	SessionID     string         `json:"sessionId" orm:"session_id"`
	RunType       string         `json:"runType" orm:"run_type"`
	Status        string         `json:"status" orm:"status"`
	InputJSON     string         `json:"-" orm:"input_json"`
	OutputJSON    string         `json:"-" orm:"output_json"`
	Summary       string         `json:"summary" orm:"summary"`
	ErrorMessage  string         `json:"errorMessage,omitempty" orm:"error_message"`
	CheckpointID  string         `json:"checkpointId,omitempty" orm:"checkpoint_id"`
	InterruptJSON string         `json:"-" orm:"interrupt_json"`
	CreatedAt     time.Time      `json:"createdAt" orm:"created_at"`
	UpdatedAt     time.Time      `json:"updatedAt" orm:"updated_at"`
	CompletedAt   *time.Time     `json:"completedAt,omitempty" orm:"completed_at"`
	Events        []RunEvent     `json:"events,omitempty"`
	Interrupt     *InterruptData `json:"interrupt,omitempty"`
}

type RunEvent struct {
	ID          string    `json:"id" orm:"id"`
	RunID       string    `json:"runId" orm:"run_id"`
	Sequence    int       `json:"sequence" orm:"sequence_no"`
	EventType   string    `json:"eventType" orm:"event_type"`
	AgentName   string    `json:"agentName,omitempty" orm:"agent_name"`
	Role        string    `json:"role,omitempty" orm:"role"`
	ToolName    string    `json:"toolName,omitempty" orm:"tool_name"`
	Content     string    `json:"content,omitempty" orm:"content"`
	PayloadJSON string    `json:"-" orm:"payload_json"`
	CreatedAt   time.Time `json:"createdAt" orm:"created_at"`
	Payload     any       `json:"payload,omitempty"`
}

type KnowledgeDocument struct {
	ID          string    `json:"id" orm:"id"`
	FileName    string    `json:"fileName" orm:"file_name"`
	Title       string    `json:"title" orm:"title"`
	ContentType string    `json:"contentType" orm:"content_type"`
	FilePath    string    `json:"filePath" orm:"file_path"`
	Status      string    `json:"status" orm:"status"`
	SourceType  string    `json:"sourceType" orm:"source_type"`
	Content     string    `json:"content,omitempty" orm:"content"`
	CreatedAt   time.Time `json:"createdAt" orm:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" orm:"updated_at"`
}

type KnowledgeIndexJob struct {
	ID             string     `json:"id" orm:"id"`
	DocumentID     string     `json:"documentId,omitempty" orm:"document_id"`
	Status         string     `json:"status" orm:"status"`
	CollectionName string     `json:"collectionName" orm:"collection_name"`
	ChunkSize      int        `json:"chunkSize" orm:"chunk_size"`
	Overlap        int        `json:"overlap" orm:"overlap"`
	TopK           int        `json:"topK" orm:"top_k"`
	IndexedChunks  int        `json:"indexedChunks" orm:"indexed_chunks"`
	ErrorMessage   string     `json:"errorMessage,omitempty" orm:"error_message"`
	CreatedAt      time.Time  `json:"createdAt" orm:"created_at"`
	UpdatedAt      time.Time  `json:"updatedAt" orm:"updated_at"`
	CompletedAt    *time.Time `json:"completedAt,omitempty" orm:"completed_at"`
}

type SessionMessage struct {
	ID        string    `json:"id" orm:"id"`
	SessionID string    `json:"sessionId" orm:"session_id"`
	Role      string    `json:"role" orm:"role"`
	Content   string    `json:"content" orm:"content"`
	CreatedAt time.Time `json:"createdAt" orm:"created_at"`
}

type CheckpointRecord struct {
	ID        string    `json:"id" orm:"id"`
	RunID     string    `json:"runId" orm:"run_id"`
	Payload   []byte    `json:"-" orm:"payload"`
	CreatedAt time.Time `json:"createdAt" orm:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" orm:"updated_at"`
}

type MCPToolDescriptor struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	SchemaJSON  string `json:"schemaJson,omitempty"`
}

type ReferenceChunk struct {
	DocumentID string         `json:"documentId"`
	Title      string         `json:"title"`
	Content    string         `json:"content"`
	Score      float64        `json:"score"`
	MetaData   map[string]any `json:"metadata,omitempty"`
}

type InterruptContext struct {
	ID          string `json:"id"`
	Address     string `json:"address"`
	Info        any    `json:"info"`
	IsRootCause bool   `json:"isRootCause"`
}

type InterruptData struct {
	Contexts []InterruptContext `json:"contexts"`
}

type CreateSessionRequest struct {
	Title string `json:"title"`
	Mode  string `json:"mode"`
}

type ChatRunRequest struct {
	SessionID string `json:"sessionId"`
	Query     string `json:"query"`
	TopK      int    `json:"topK"`
}

type OpsRunRequest struct {
	SessionID   string `json:"sessionId"`
	AlertTitle  string `json:"alertTitle"`
	ServiceName string `json:"serviceName"`
	Severity    string `json:"severity"`
	Summary     string `json:"summary"`
}

type ResumeRunRequest struct {
	InterruptID string `json:"interruptId"`
	Approved    bool   `json:"approved"`
	Note        string `json:"note"`
}

type CreateKnowledgeIndexJobRequest struct {
	DocumentIDs []string `json:"documentIds"`
	ChunkSize   int      `json:"chunkSize"`
	Overlap     int      `json:"overlap"`
	TopK        int      `json:"topK"`
}

type APIDataResponse[T any] struct {
	Message string `json:"message"`
	Data    T      `json:"data"`
}

type APIListResponse[T any] struct {
	Message string `json:"message"`
	Data    []T    `json:"data"`
}

type APIRunResponse struct {
	Message string `json:"message"`
	Data    Run    `json:"data"`
}
