package api

import (
	"github.com/go-chi/chi/v5"
	"net/http" // Add this import for http.ResponseWriter and http.Request
)

func setupRoutes(r chi.Router, handlers *routeHandlers) {

	r.Post("/chat", handlers.chatHandler.handleChat())
	r.Post("/chat/stream", handlers.chatHandler.handleChatStream())
	r.Post("/chat/identify", handlers.chatHandler.handleChatIdentify())
	r.Get("/competitors/{competitorID}", handlers.competitorHandler.getDrilldown())

	// Session routes
	r.Get("/sessions", handlers.sessionHandler.listSessions)
	r.Post("/sessions", handlers.sessionHandler.createSession)
	r.Get("/sessions/{sessionID}", handlers.sessionHandler.getSession)
	r.Get("/sessions/{sessionID}/competitors", handlers.sessionHandler.getSessionCompetitors)
	r.Patch("/sessions/{sessionID}", handlers.sessionHandler.updateSessionTitle)
	r.Post("/sessions/{sessionID}/summarize", handlers.sessionHandler.summarizeSessionTitle)
	r.Delete("/sessions/{sessionID}", handlers.sessionHandler.deleteSession)

	r.Get("/test", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	})
}
