package api

import (
	"os"

	"github.com/rpupo63/report-backend/database"
	"github.com/rpupo63/report-backend/services"
)

func initializeHandlers(db database.Database, llmClient services.LLMClientInterface) *routeHandlers {
	agent := services.NewStrategyAgent(db.CompanyRepo(), db.CompetitorRepo(), db.IntelDossierRepo(), llmClient)

	serpClient := services.NewSerpClient(os.Getenv("SERP_API_KEY"), llmClient)
	enrichClient := services.NewEnrichClient(os.Getenv("ENRICH_API_KEY"))

	// Create chatHandler
	chatH := newChatHandler(
		db.CompanyRepo(),
		db.CompetitorRepo(),
		db.IntelDossierRepo(),
		db.ChatSessionRepo(),
		db.ChatMessageRepo(),
		db.SessionCompetitorRepo(),
		agent,
	)

	// Create sessionHandler
	sessionH := newSessionHandler(
		db.ChatSessionRepo(),
		db.ChatMessageRepo(),
		db.CompetitorRepo(),
		db.IntelDossierRepo(),
		db.SessionCompetitorRepo(),
		llmClient,
	)

	return &routeHandlers{
		chatHandler:       chatH,
		competitorHandler: newCompetitorHandler(db.CompetitorRepo(), serpClient, enrichClient, llmClient),
		sessionHandler:    sessionH,
	}
}
