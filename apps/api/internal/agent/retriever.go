package agent

import (
	"context"
	"math"
	"sort"
	"strings"
	"unicode"

	"aegisflow-api/internal/model"
	"aegisflow-api/internal/repository"
)

type Retriever struct {
	repo *repository.Repository
}

func NewRetriever(repo *repository.Repository) *Retriever {
	return &Retriever{repo: repo}
}

func (r *Retriever) Search(ctx context.Context, query string, topK int) ([]model.Reference, error) {
	views, err := r.repo.ListChunkViews(ctx)
	if err != nil {
		return nil, err
	}
	if topK <= 0 {
		topK = 3
	}
	queryTokens := tokenize(query)
	scored := make([]model.Reference, 0, len(views))
	for _, item := range views {
		score := similarity(queryTokens, tokenize(item.Content))
		if score <= 0 {
			continue
		}
		scored = append(scored, model.Reference{
			DocumentID: item.DocumentID,
			Title:      item.Title,
			Excerpt:    excerpt(item.Content, 120),
			Score:      math.Round(score*100) / 100,
		})
	}
	sort.SliceStable(scored, func(i int, j int) bool {
		return scored[i].Score > scored[j].Score
	})
	if len(scored) > topK {
		scored = scored[:topK]
	}
	return scored, nil
}

func tokenize(text string) []string {
	tokens := make([]string, 0)
	var current []rune
	flush := func() {
		if len(current) > 0 {
			tokens = append(tokens, strings.ToLower(string(current)))
			current = current[:0]
		}
	}
	for _, r := range []rune(strings.TrimSpace(text)) {
		switch {
		case unicode.Is(unicode.Han, r):
			flush()
			tokens = append(tokens, string(r))
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			current = append(current, unicode.ToLower(r))
		default:
			flush()
		}
	}
	flush()
	return tokens
}

func similarity(a []string, b []string) float64 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	left := make(map[string]int, len(a))
	right := make(map[string]int, len(b))
	for _, token := range a {
		left[token]++
	}
	for _, token := range b {
		right[token]++
	}
	shared := 0
	for token, count := range left {
		if other, ok := right[token]; ok {
			if count < other {
				shared += count
			} else {
				shared += other
			}
		}
	}
	if shared == 0 {
		return 0
	}
	return float64(shared) / math.Sqrt(float64(len(a))*float64(len(b)))
}

func excerpt(text string, max int) string {
	runes := []rune(strings.TrimSpace(text))
	if len(runes) <= max {
		return string(runes)
	}
	return string(runes[:max]) + "..."
}
