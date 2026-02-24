package models

import "github.com/google/uuid"

type Competitor struct {
	ID             uuid.UUID              `json:"id"           gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	CompanyID      uuid.UUID              `json:"-"            gorm:"type:uuid;not null;index"`
	Name           string                 `json:"name"         gorm:"type:text;not null"`
	Website        string                 `json:"website"      gorm:"type:text;not null"`
	ThreatLevel    string                 `json:"threat_level" gorm:"type:text;not null"` // LOW|MODERATE|HIGH|CRITICAL
	Status         string                 `json:"status"       gorm:"type:text;not null"`
	Intel          string                 `json:"intel"        gorm:"type:text;not null"`
	MarketShare    string                 `json:"-"            gorm:"type:text;not null"`
	FinalAnalysis  string                 `json:"-"            gorm:"type:text;not null"`
	IntelLevel     int                    `json:"-"            gorm:"type:integer;not null"`
	Recommendation string                 `json:"-"            gorm:"type:text;not null"`
	SerpFetched    bool                   `json:"-"            gorm:"type:boolean;not null;default:false"`
	KeyProducts    []CompetitorKeyProduct `json:"-"            gorm:"foreignKey:CompetitorID;constraint:OnDelete:CASCADE"`
	Challenges     []CompetitorChallenge  `json:"-"            gorm:"foreignKey:CompetitorID;constraint:OnDelete:CASCADE"`
	Reasonings     []CompetitorReasoning  `json:"-"            gorm:"foreignKey:CompetitorID;constraint:OnDelete:CASCADE"`
}
