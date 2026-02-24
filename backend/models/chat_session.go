package models

import (
	"time"

	"github.com/google/uuid"
)

type ChatSession struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Title     string    `gorm:"type:text;not null;default:'New operation'"`
	CreatedAt time.Time
	UpdatedAt time.Time
	Messages  []ChatMessage `gorm:"foreignKey:SessionID;constraint:OnDelete:CASCADE"`
}
