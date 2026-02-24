package database

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/rpupo63/report-backend/models"
)

type ChatSessionRepoInterface interface {
	FindAll() ([]models.ChatSession, error)
	FindByID(id uuid.UUID) (*models.ChatSession, error)
	Create(session models.ChatSession) (*models.ChatSession, error)
	UpdateTitle(id uuid.UUID, title string) error
	Delete(id uuid.UUID) error
}

type ChatSessionRepo struct {
	db *gorm.DB
}

func NewChatSessionRepo(db *gorm.DB) *ChatSessionRepo {
	return &ChatSessionRepo{db: db}
}

func (r *ChatSessionRepo) FindAll() ([]models.ChatSession, error) {
	var sessions []models.ChatSession
	if err := r.db.Order("created_at DESC").Find(&sessions).Error; err != nil {
		return nil, err
	}
	return sessions, nil
}

func (r *ChatSessionRepo) FindByID(id uuid.UUID) (*models.ChatSession, error) {
	var session models.ChatSession
	if err := r.db.First(&session, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *ChatSessionRepo) Create(session models.ChatSession) (*models.ChatSession, error) {
	if err := r.db.Create(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *ChatSessionRepo) UpdateTitle(id uuid.UUID, title string) error {
	return r.db.Model(&models.ChatSession{}).Where("id = ?", id).Updates(map[string]interface{}{
		"title":      title,
		"updated_at": time.Now(),
	}).Error
}

func (r *ChatSessionRepo) Delete(id uuid.UUID) error {
	// GORM's association deletion with "constraint:OnDelete:CASCADE" handles messages
	return r.db.Delete(&models.ChatSession{}, "id = ?", id).Error
}
