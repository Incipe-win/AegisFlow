package runtime

import (
	"context"
	"fmt"
	"strings"

	"aegisflow-api/internal/model"

	"github.com/cloudwego/eino/components/embedding"
	"github.com/cloudwego/eino/schema"
	milvusclient "github.com/milvus-io/milvus-sdk-go/v2/client"
	"github.com/milvus-io/milvus-sdk-go/v2/entity"
)

const (
	milvusCollectionDescription = "AegisFlow knowledge collection"
	milvusIDField              = "id"
	milvusTitleField           = "title"
	milvusContentField         = "content"
	milvusVectorField          = "vector"
	milvusTitleMaxLength       = 512
	milvusContentMaxLength     = 8192
)

type MilvusKnowledgeIndexer struct {
	client     milvusclient.Client
	collection string
	embedder   embedding.Embedder
}

func (i *MilvusKnowledgeIndexer) Store(ctx context.Context, docs []*schema.Document) ([]string, error) {
	if len(docs) == 0 {
		return []string{}, nil
	}

	texts := make([]string, 0, len(docs))
	for _, doc := range docs {
		texts = append(texts, doc.Content)
	}

	vectors, err := i.embedder.EmbedStrings(ctx, texts)
	if err != nil {
		return nil, err
	}

	dim, err := validateEmbeddingVectors(vectors)
	if err != nil {
		return nil, err
	}
	if err := ensureFloatVectorCollection(ctx, i.client, i.collection, dim); err != nil {
		return nil, err
	}

	ids := make([]string, 0, len(docs))
	titles := make([]string, 0, len(docs))
	contents := make([]string, 0, len(docs))
	floatVectors := make([][]float32, 0, len(docs))
	for idx, doc := range docs {
		ids = append(ids, doc.ID)
		titles = append(titles, milvusDocumentTitle(doc))
		contents = append(contents, truncateForMilvus(doc.Content, milvusContentMaxLength))
		floatVectors = append(floatVectors, toFloat32Vector(vectors[idx]))
	}

	_, err = i.client.Insert(
		ctx,
		i.collection,
		"",
		entity.NewColumnVarChar(milvusIDField, ids),
		entity.NewColumnVarChar(milvusTitleField, titles),
		entity.NewColumnVarChar(milvusContentField, contents),
		entity.NewColumnFloatVector(milvusVectorField, dim, floatVectors),
	)
	if err != nil {
		return nil, fmt.Errorf("[MilvusKnowledgeIndexer.Store] failed to insert rows: %w", err)
	}

	if err := i.client.Flush(ctx, i.collection, false); err != nil {
		return nil, fmt.Errorf("[MilvusKnowledgeIndexer.Store] failed to flush collection: %w", err)
	}
	return ids, nil
}

func retrieveMilvusReferences(ctx context.Context, cli milvusclient.Client, collection string, emb embedding.Embedder, query string, topK int) ([]model.ReferenceChunk, error) {
	hasCollection, err := cli.HasCollection(ctx, collection)
	if err != nil {
		return nil, err
	}
	if !hasCollection {
		return []model.ReferenceChunk{}, nil
	}

	description, err := cli.DescribeCollection(ctx, collection)
	if err != nil {
		return nil, err
	}
	if description == nil || description.Schema == nil || !isFloatVectorSchemaCompatible(description.Schema, 0) {
		return []model.ReferenceChunk{}, nil
	}
	if !description.Loaded {
		if err := cli.LoadCollection(ctx, collection, false); err != nil {
			return nil, err
		}
	}

	vectors, err := emb.EmbedStrings(ctx, []string{query})
	if err != nil {
		return nil, err
	}
	dim, err := validateEmbeddingVectors(vectors)
	if err != nil {
		return nil, err
	}
	if !isFloatVectorSchemaCompatible(description.Schema, dim) {
		return []model.ReferenceChunk{}, nil
	}

	searchParam, err := entity.NewIndexAUTOINDEXSearchParam(1)
	if err != nil {
		return nil, err
	}

	results, err := cli.Search(
		ctx,
		collection,
		nil,
		"",
		[]string{milvusTitleField, milvusContentField},
		[]entity.Vector{entity.FloatVector(toFloat32Vector(vectors[0]))},
		milvusVectorField,
		entity.COSINE,
		normalizeTopK(topK),
		searchParam,
	)
	if err != nil {
		return nil, err
	}

	refs := make([]model.ReferenceChunk, 0)
	for _, result := range results {
		if result.Err != nil {
			return nil, result.Err
		}
		for idx := 0; idx < result.ResultCount; idx++ {
			documentID, err := result.IDs.GetAsString(idx)
			if err != nil {
				return nil, err
			}
			title, err := searchResultStringField(result, milvusTitleField, idx)
			if err != nil {
				return nil, err
			}
			content, err := searchResultStringField(result, milvusContentField, idx)
			if err != nil {
				return nil, err
			}
			score := 0.0
			if idx < len(result.Scores) {
				score = float64(result.Scores[idx])
			}
			refs = append(refs, model.ReferenceChunk{
				DocumentID: documentID,
				Title:      title,
				Content:    content,
				Score:      score,
				MetaData: map[string]any{
					"source": "milvus",
				},
			})
		}
	}
	return refs, nil
}

func ensureFloatVectorCollection(ctx context.Context, cli milvusclient.Client, collection string, dim int) error {
	hasCollection, err := cli.HasCollection(ctx, collection)
	if err != nil {
		return err
	}

	if hasCollection {
		description, err := cli.DescribeCollection(ctx, collection)
		if err != nil {
			return err
		}
		if description != nil && description.Schema != nil && isFloatVectorSchemaCompatible(description.Schema, dim) {
			if !description.Loaded {
				return cli.LoadCollection(ctx, collection, false)
			}
			return nil
		}
		if err := cli.DropCollection(ctx, collection); err != nil {
			return fmt.Errorf("drop incompatible collection: %w", err)
		}
	}

	schema := entity.NewSchema().
		WithName(collection).
		WithDescription(milvusCollectionDescription).
		WithField(entity.NewField().
			WithName(milvusIDField).
			WithDataType(entity.FieldTypeVarChar).
			WithIsPrimaryKey(true).
			WithMaxLength(255)).
		WithField(entity.NewField().
			WithName(milvusTitleField).
			WithDataType(entity.FieldTypeVarChar).
			WithMaxLength(milvusTitleMaxLength)).
		WithField(entity.NewField().
			WithName(milvusContentField).
			WithDataType(entity.FieldTypeVarChar).
			WithMaxLength(milvusContentMaxLength)).
		WithField(entity.NewField().
			WithName(milvusVectorField).
			WithDataType(entity.FieldTypeFloatVector).
			WithDim(int64(dim)))

	if err := cli.CreateCollection(ctx, schema, entity.DefaultShardNumber); err != nil {
		return fmt.Errorf("create collection: %w", err)
	}

	index, err := entity.NewIndexAUTOINDEX(entity.COSINE)
	if err != nil {
		return fmt.Errorf("create autoin index config: %w", err)
	}
	if err := cli.CreateIndex(ctx, collection, milvusVectorField, index, false); err != nil {
		return fmt.Errorf("create vector index: %w", err)
	}
	if err := cli.LoadCollection(ctx, collection, false); err != nil {
		return fmt.Errorf("load collection: %w", err)
	}
	return nil
}

func isFloatVectorSchemaCompatible(schema *entity.Schema, dim int) bool {
	if schema == nil {
		return false
	}
	var foundID, foundTitle, foundContent, foundVector bool
	for _, field := range schema.Fields {
		switch field.Name {
		case milvusIDField:
			foundID = field.DataType == entity.FieldTypeVarChar
		case milvusTitleField:
			foundTitle = field.DataType == entity.FieldTypeVarChar
		case milvusContentField:
			foundContent = field.DataType == entity.FieldTypeVarChar
		case milvusVectorField:
			if field.DataType != entity.FieldTypeFloatVector {
				return false
			}
			if dim > 0 && field.TypeParams[entity.TypeParamDim] != fmt.Sprintf("%d", dim) {
				return false
			}
			foundVector = true
		}
	}
	return foundID && foundTitle && foundContent && foundVector
}

func validateEmbeddingVectors(vectors [][]float64) (int, error) {
	if len(vectors) == 0 {
		return 0, fmt.Errorf("embedding returned no vectors")
	}
	dim := len(vectors[0])
	if dim == 0 {
		return 0, fmt.Errorf("embedding returned empty vectors")
	}
	for _, vector := range vectors[1:] {
		if len(vector) != dim {
			return 0, fmt.Errorf("embedding vector dimensions do not match")
		}
	}
	return dim, nil
}

func toFloat32Vector(vector []float64) []float32 {
	out := make([]float32, 0, len(vector))
	for _, value := range vector {
		out = append(out, float32(value))
	}
	return out
}

func milvusDocumentTitle(doc *schema.Document) string {
	if doc == nil {
		return ""
	}
	if value, ok := doc.MetaData["title"].(string); ok && strings.TrimSpace(value) != "" {
		return truncateForMilvus(value, milvusTitleMaxLength)
	}
	return truncateForMilvus(doc.ID, milvusTitleMaxLength)
}

func truncateForMilvus(value string, maxLen int) string {
	value = strings.TrimSpace(value)
	if maxLen <= 0 || len(value) <= maxLen {
		return value
	}
	return value[:maxLen]
}

func searchResultStringField(result milvusclient.SearchResult, fieldName string, idx int) (string, error) {
	for _, field := range result.Fields {
		if field.Name() != fieldName {
			continue
		}
		return field.GetAsString(idx)
	}
	return "", fmt.Errorf("field %s not found in search result", fieldName)
}

func normalizeTopK(topK int) int {
	if topK <= 0 {
		return 4
	}
	return topK
}
