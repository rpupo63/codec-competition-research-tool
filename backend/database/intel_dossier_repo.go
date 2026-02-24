package database

import (
	"github.com/google/uuid"
	"github.com/rpupo63/report-backend/models"
	"gorm.io/gorm"
)

type IntelDossierRepoInterface interface {
	FindByCompanyID(companyID uuid.UUID) (*models.IntelDossier, error)
	CreateIntelDossier(dossier *models.IntelDossier) error
	AddMatrixEntry(entry models.DossierMatrixEntry) error
	AddChallenge(v models.DossierChallenge) (*models.DossierChallenge, error)
	AddChallengeGap(gap models.DossierChallengeGap) error
	AddStrikePlan(sp models.DossierStrikePlan) error
}

type IntelDossierRepo struct {
	db *gorm.DB
}

func newIntelDossierRepo(db *gorm.DB) *IntelDossierRepo {
	return &IntelDossierRepo{db: db}
}

func (r *IntelDossierRepo) FindByCompanyID(companyID uuid.UUID) (*models.IntelDossier, error) {
	var dossier models.IntelDossier
	result := r.db.
		Preload("Matrix").
		Preload("Challenges").
		Preload("Challenges.Gaps").
		Preload("StrikePlan").
		First(&dossier, "company_id = ?", companyID)
	if result.Error == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &dossier, result.Error
}

func (r *IntelDossierRepo) CreateIntelDossier(dossier *models.IntelDossier) error {
	result := r.db.Create(dossier)
	return result.Error
}

func (r *IntelDossierRepo) AddMatrixEntry(entry models.DossierMatrixEntry) error {
	return r.db.Create(&entry).Error
}

func (r *IntelDossierRepo) AddChallenge(v models.DossierChallenge) (*models.DossierChallenge, error) {
	result := r.db.Create(&v)
	return &v, result.Error
}

func (r *IntelDossierRepo) AddChallengeGap(gap models.DossierChallengeGap) error {
	return r.db.Create(&gap).Error
}

func (r *IntelDossierRepo) AddStrikePlan(sp models.DossierStrikePlan) error {
	return r.db.Create(&sp).Error
}
