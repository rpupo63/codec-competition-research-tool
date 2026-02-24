package models

import (
	"time"

	"github.com/google/uuid"
)

// Sender stores the display-level sender (SNAKE/COLONEL/SYSTEM/INTEL), not LLM role.
// This allows exact reconstruction on the frontend without lossy transformation.
type ChatMessage struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	SessionID        uuid.UUID `gorm:"type:uuid;not null;index"`
	TabID            string    `gorm:"type:text;not null;default:'main'"`
	SortOrder        int       `gorm:"type:integer;not null;default:0"` // preserves order deterministically
	Sender           string    `gorm:"type:text;not null"`
	Text             string    `gorm:"type:text;not null"`
	IsReasoning      bool      `gorm:"default:false"`
	ReasoningStatus  string    `gorm:"type:text;default:'complete'"`
	ReasoningSummary string    `gorm:"type:text;default:''"`
	CreatedAt        time.Time
}
