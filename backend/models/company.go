package models

import "github.com/google/uuid"

type Company struct {
	ID   uuid.UUID `json:"id"   gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name string    `json:"name" gorm:"type:text;not null;unique"`
	Slug string    `json:"slug" gorm:"type:text;not null;uniqueIndex"` // lowercase, used for message matching
}
