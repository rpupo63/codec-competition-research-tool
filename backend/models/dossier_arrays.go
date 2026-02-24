package models

import "github.com/google/uuid"

type DossierMatrixEntry struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	DossierID      uuid.UUID `gorm:"type:uuid;not null;index"`
	Name           string    `gorm:"type:text;not null"`
	ThreatLevel    string    `gorm:"column:threat_level;type:text;not null"`
	MarketShare    string    `gorm:"column:market_share;type:text;not null"`
	KeyStrength    string    `gorm:"column:key_strength;type:text;not null"`
	PrimaryProduct string    `gorm:"column:primary_product;type:text;not null"`
	AICapability   string    `gorm:"column:ai_capability;type:text;not null"` // LOW|MODERATE|HIGH|CRITICAL
}

type DossierChallenge struct {
	ID         uuid.UUID             `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	DossierID  uuid.UUID             `gorm:"type:uuid;not null;index"`
	Competitor string                `gorm:"type:text;not null"`
	Gaps       []DossierChallengeGap `gorm:"foreignKey:ChallengeID;constraint:OnDelete:CASCADE"`
}

type DossierChallengeGap struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ChallengeID uuid.UUID `gorm:"type:uuid;not null;index"`
	Value       string    `gorm:"type:text;not null"`
}

type DossierStrikePlan struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	DossierID uuid.UUID `gorm:"type:uuid;not null;index"`
	Codename  string    `gorm:"type:text;not null"`
	Objective string    `gorm:"type:text;not null"`
	Target    string    `gorm:"type:text;not null"`
	Approach  string    `gorm:"type:text;not null"`
	Timeline  string    `gorm:"type:text;not null"`
	Priority  string    `gorm:"type:text;not null"` // ALPHA|BRAVO|CHARLIE
}
