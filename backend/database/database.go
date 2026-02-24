package database

import (
	"os"

	"github.com/rpupo63/report-backend/models"
	"gorm.io/gorm"
)

type Database struct {
	db                    *gorm.DB
	companyRepo           CompanyRepoInterface
	competitorRepo        CompetitorRepoInterface
	intelDossierRepo      IntelDossierRepoInterface
	chatSessionRepo       ChatSessionRepoInterface
	chatMessageRepo       ChatMessageRepoInterface
	sessionCompetitorRepo SessionCompetitorRepoInterface
}

func New(db *gorm.DB) Database {
	return Database{
		db:                    db,
		companyRepo:           newCompanyRepo(db),
		competitorRepo:        newCompetitorRepo(db),
		intelDossierRepo:      newIntelDossierRepo(db),
		chatSessionRepo:       NewChatSessionRepo(db),
		chatMessageRepo:       NewChatMessageRepo(db),
		sessionCompetitorRepo: NewSessionCompetitorRepo(db),
	}
}

func (d Database) CompanyRepo() CompanyRepoInterface {
	return d.companyRepo
}

func (d Database) CompetitorRepo() CompetitorRepoInterface {
	return d.competitorRepo
}

func (d Database) IntelDossierRepo() IntelDossierRepoInterface {
	return d.intelDossierRepo
}

func (d Database) ChatSessionRepo() ChatSessionRepoInterface {
	return d.chatSessionRepo
}

func (d Database) ChatMessageRepo() ChatMessageRepoInterface {
	return d.chatMessageRepo
}

func (d Database) SessionCompetitorRepo() SessionCompetitorRepoInterface {
	return d.sessionCompetitorRepo
}

func (d Database) DB() *gorm.DB {
	return d.db
}

// AutoMigrate runs GORM auto-migration for all models
func (d Database) AutoMigrate() error {
	if os.Getenv("GENERATE_MODELS") == "true" {
		if err := d.db.AutoMigrate(models.AllModels()...); err != nil {
			return err
		}
	}
	return nil
}
