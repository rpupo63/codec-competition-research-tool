package models

import "github.com/google/uuid"

type CompetitorKeyProduct struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	CompetitorID uuid.UUID `gorm:"type:uuid;not null;index"`
	Value        string    `gorm:"type:text;not null"`
}

type CompetitorChallenge struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	CompetitorID uuid.UUID `gorm:"type:uuid;not null;index"`
	Value        string    `gorm:"type:text;not null"`
}

type CompetitorReasoning struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	CompetitorID uuid.UUID `gorm:"type:uuid;not null;index"`
	SortOrder    int       `gorm:"type:integer;not null;default:0"`
	Step         string    `gorm:"type:text;not null"`
	Summary      string    `gorm:"type:text;not null"`
	Status       string    `gorm:"type:text;not null;default:'complete'"`
}
