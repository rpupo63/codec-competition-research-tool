package database

import (
	"strings"

	"github.com/google/uuid"
	"github.com/rpupo63/report-backend/models"
	"gorm.io/gorm"
)

type CompanyRepoInterface interface {
	FindAll() ([]models.Company, error)
	FindByID(id uuid.UUID) (*models.Company, error)
	FindByMessageSubstring(message string) (*models.Company, error)
	Add(company models.Company) (*models.Company, error)
}

type CompanyRepo struct {
	db *gorm.DB
}

func newCompanyRepo(db *gorm.DB) *CompanyRepo {
	return &CompanyRepo{db: db}
}

func (r *CompanyRepo) FindAll() ([]models.Company, error) {
	var companies []models.Company
	result := r.db.Find(&companies)
	return companies, result.Error
}

func (r *CompanyRepo) FindByID(id uuid.UUID) (*models.Company, error) {
	var company models.Company
	result := r.db.First(&company, "id = ?", id)
	if result.Error == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &company, result.Error
}

func (r *CompanyRepo) FindByMessageSubstring(message string) (*models.Company, error) {
	companies, err := r.FindAll()
	if err != nil {
		return nil, err
	}

	lower := strings.ToLower(message)
	for i := range companies {
		nameLower := strings.ToLower(companies[i].Name)
		slugLower := strings.ToLower(companies[i].Slug)
		if strings.Contains(lower, nameLower) ||
			strings.Contains(lower, slugLower) ||
			strings.Contains(nameLower, lower) ||
			strings.Contains(slugLower, lower) {
			return &companies[i], nil
		}
	}
	return nil, nil
}

func (r *CompanyRepo) Add(company models.Company) (*models.Company, error) {
	result := r.db.FirstOrCreate(&company, models.Company{Slug: company.Slug})
	return &company, result.Error
}
