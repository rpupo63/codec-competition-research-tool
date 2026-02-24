package database

import (
	"github.com/google/uuid"
	"github.com/rpupo63/report-backend/models"
	"gorm.io/gorm"
)

type CompetitorRepoInterface interface {
	FindByCompanyID(companyID uuid.UUID) ([]models.Competitor, error)
	FindByID(id uuid.UUID) (*models.Competitor, error)
	CreateCompetitor(competitor *models.Competitor) error
	AddKeyProduct(kp models.CompetitorKeyProduct) error
	AddChallenge(c models.CompetitorChallenge) error
	AddReasoning(rn models.CompetitorReasoning) error
	DeleteChallengesByCompetitorID(competitorID uuid.UUID) error
	DeleteKeyProductsByCompetitorID(competitorID uuid.UUID) error
	DeleteReasoningsByCompetitorID(competitorID uuid.UUID) error
	UpdateSerpData(id uuid.UUID, intel, marketShare, finalAnalysis, recommendation string, intelLevel int, threatLevel string, serpFetched bool) error
}

type CompetitorRepo struct {
	db *gorm.DB
}

func newCompetitorRepo(db *gorm.DB) *CompetitorRepo {
	return &CompetitorRepo{db: db}
}

func (r *CompetitorRepo) FindByCompanyID(companyID uuid.UUID) ([]models.Competitor, error) {
	var competitors []models.Competitor
	result := r.db.
		Preload("KeyProducts").
		Preload("Challenges").
		Preload("Reasonings").
		Where("company_id = ?", companyID).
		Find(&competitors)
	return competitors, result.Error
}

func (r *CompetitorRepo) FindByID(id uuid.UUID) (*models.Competitor, error) {
	var competitor models.Competitor
	result := r.db.
		Preload("KeyProducts").
		Preload("Challenges").
		Preload("Reasonings").
		First(&competitor, "id = ?", id)
	if result.Error == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &competitor, result.Error
}

func (r *CompetitorRepo) CreateCompetitor(competitor *models.Competitor) error {
	result := r.db.Create(competitor)
	return result.Error
}

func (r *CompetitorRepo) AddKeyProduct(kp models.CompetitorKeyProduct) error {
	return r.db.Create(&kp).Error
}

func (r *CompetitorRepo) AddChallenge(c models.CompetitorChallenge) error {
	return r.db.Create(&c).Error
}

func (r *CompetitorRepo) AddReasoning(rn models.CompetitorReasoning) error {
	return r.db.Create(&rn).Error
}

func (r *CompetitorRepo) DeleteChallengesByCompetitorID(competitorID uuid.UUID) error {
	return r.db.Where("competitor_id = ?", competitorID).Delete(&models.CompetitorChallenge{}).Error
}

func (r *CompetitorRepo) DeleteKeyProductsByCompetitorID(competitorID uuid.UUID) error {
	return r.db.Where("competitor_id = ?", competitorID).Delete(&models.CompetitorKeyProduct{}).Error
}

func (r *CompetitorRepo) DeleteReasoningsByCompetitorID(competitorID uuid.UUID) error {
	return r.db.Where("competitor_id = ?", competitorID).Delete(&models.CompetitorReasoning{}).Error
}

func (r *CompetitorRepo) UpdateSerpData(id uuid.UUID, intel, marketShare, finalAnalysis, recommendation string, intelLevel int, threatLevel string, serpFetched bool) error {
	return r.db.Model(&models.Competitor{}).Where("id = ?", id).Updates(map[string]interface{}{
		"intel":          intel,
		"market_share":   marketShare,
		"final_analysis": finalAnalysis,
		"recommendation": recommendation,
		"intel_level":    intelLevel,
		"threat_level":   threatLevel,
		"serp_fetched":   serpFetched,
	}).Error
}
