package database

import (
	"github.com/rpupo63/report-backend/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ChatMessageRepoInterface interface {
	FindBySessionID(sessionID uuid.UUID) ([]models.ChatMessage, error)
	FindMainBySessionID(sessionID uuid.UUID) ([]models.ChatMessage, error)
	NextSortOrder(sessionID uuid.UUID) (int, error)
	Add(msg models.ChatMessage) (*models.ChatMessage, error)
}

type ChatMessageRepo struct {
	db *gorm.DB
}

func NewChatMessageRepo(db *gorm.DB) *ChatMessageRepo {
	return &ChatMessageRepo{db: db}
}

func (r *ChatMessageRepo) FindBySessionID(sessionID uuid.UUID) ([]models.ChatMessage, error) {
	var messages []models.ChatMessage
	if err := r.db.Where("session_id = ?", sessionID).Order("sort_order ASC").Find(&messages).Error; err != nil {
		return nil, err
	}
	return messages, nil
}

func (r *ChatMessageRepo) FindMainBySessionID(sessionID uuid.UUID) ([]models.ChatMessage, error) {
	var messages []models.ChatMessage
	if err := r.db.Where("session_id = ? AND tab_id = 'main'", sessionID).Order("sort_order ASC").Find(&messages).Error; err != nil {
		return nil, err
	}
	return messages, nil
}

func (r *ChatMessageRepo) NextSortOrder(sessionID uuid.UUID) (int, error) {
	var maxSortOrder int
	// Select MAX(sort_order) for the given session_id
	result := r.db.Model(&models.ChatMessage{}).
		Where("session_id = ?", sessionID).
		Select("COALESCE(MAX(sort_order), -1)").
		Row().Scan(&maxSortOrder)

	if result != nil && result != gorm.ErrRecordNotFound {
		return 0, result
	}
	return maxSortOrder + 1, nil
}

func (r *ChatMessageRepo) Add(msg models.ChatMessage) (*models.ChatMessage, error) {
	if err := r.db.Create(&msg).Error; err != nil {
		return nil, err
	}
	return &msg, nil
}
