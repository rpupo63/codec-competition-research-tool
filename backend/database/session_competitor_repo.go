package database

import (
	"github.com/google/uuid"
	"github.com/rpupo63/report-backend/models"
	"gorm.io/gorm"
)

type SessionCompetitorRepoInterface interface {
	FindBySessionID(id uuid.UUID) ([]models.SessionCompetitor, error)
	Add(sc models.SessionCompetitor) error
	Exists(sessionID, competitorID uuid.UUID) (bool, error)
}

type SessionCompetitorRepo struct{ db *gorm.DB }

func NewSessionCompetitorRepo(db *gorm.DB) *SessionCompetitorRepo {
	return &SessionCompetitorRepo{db: db}
}

func (r *SessionCompetitorRepo) FindBySessionID(id uuid.UUID) ([]models.SessionCompetitor, error) {
	var rows []models.SessionCompetitor
	err := r.db.Where("session_id = ?", id).Find(&rows).Error
	return rows, err
}

func (r *SessionCompetitorRepo) Add(sc models.SessionCompetitor) error {
	return r.db.Create(&sc).Error
}

// Exists returns true if this competitor is already linked to this session.
func (r *SessionCompetitorRepo) Exists(sessionID, competitorID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&models.SessionCompetitor{}).
		Where("session_id = ? AND competitor_id = ?", sessionID, competitorID).
		Count(&count).Error
	return count > 0, err
}
