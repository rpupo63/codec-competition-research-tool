package models

import "github.com/google/uuid"

type IntelDossier struct {
	ID             uuid.UUID            `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	CompanyID      uuid.UUID            `gorm:"type:uuid;not null;uniqueIndex"`
	Classification string               `gorm:"type:text;not null"`
	TargetCompany  string               `gorm:"type:text;not null"`
	OperationName  string               `gorm:"type:text;not null"`
	DateCompiled   string               `gorm:"type:text;not null"`
	Matrix         []DossierMatrixEntry `gorm:"foreignKey:DossierID;constraint:OnDelete:CASCADE"`
	Challenges     []DossierChallenge   `gorm:"foreignKey:DossierID;constraint:OnDelete:CASCADE"`
	StrikePlan     []DossierStrikePlan  `gorm:"foreignKey:DossierID;constraint:OnDelete:CASCADE"`
}
