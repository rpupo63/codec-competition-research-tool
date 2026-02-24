package models

import (
	"time"

	"github.com/google/uuid"
)

// SessionCompetitor links which competitors were identified in a session.
type SessionCompetitor struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	SessionID    uuid.UUID `gorm:"type:uuid;not null;index"`
	CompetitorID uuid.UUID `gorm:"type:uuid;not null"`
	CreatedAt    time.Time
}
