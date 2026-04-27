package repository

import (
	"github.com/gogf/gf/v2/database/gdb"
)

type Repository struct {
	db gdb.DB
}

func New(db gdb.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) DB() gdb.DB {
	return r.db
}
