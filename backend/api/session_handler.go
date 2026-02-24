package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rpupo63/report-backend/database"
	"github.com/rpupo63/report-backend/models"
	"github.com/rs/zerolog/log"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/rpupo63/report-backend/errs"
	"github.com/rpupo63/report-backend/services"
)

type sessionHandler struct {
	sessionRepo           database.ChatSessionRepoInterface
	messageRepo           database.ChatMessageRepoInterface
	competitorRepo        database.CompetitorRepoInterface
	dossierRepo           database.IntelDossierRepoInterface
	sessionCompetitorRepo database.SessionCompetitorRepoInterface
	llmClient             services.LLMClientInterface
}

func newSessionHandler(
	sessionRepo database.ChatSessionRepoInterface,
	messageRepo database.ChatMessageRepoInterface,
	competitorRepo database.CompetitorRepoInterface,
	dossierRepo database.IntelDossierRepoInterface,
	sessionCompetitorRepo database.SessionCompetitorRepoInterface,
	llmClient services.LLMClientInterface,
) sessionHandler {
	return sessionHandler{
		sessionRepo:           sessionRepo,
		messageRepo:           messageRepo,
		competitorRepo:        competitorRepo,
		dossierRepo:           dossierRepo,
		sessionCompetitorRepo: sessionCompetitorRepo,
		llmClient:             llmClient,
	}
}

// SessionResponse represents a chat session for API responses.
type SessionResponse struct {
	ID        uuid.UUID `json:"id"`
	Title     string    `json:"title"`
	CreatedAt int64     `json:"created_at"` // Unix milliseconds
}

// MessageResponse represents a chat message for API responses.
type MessageResponse struct {
	ID               uuid.UUID `json:"id"`
	TabID            string    `json:"tab_id"`
	SortOrder        int       `json:"sort_order"`
	Sender           string    `json:"sender"`
	Text             string    `json:"text"`
	IsReasoning      bool      `json:"is_reasoning"`
	ReasoningStatus  string    `json:"reasoning_status"`
	ReasoningSummary string    `json:"reasoning_summary"`
	CreatedAt        int64     `json:"created_at"` // Unix milliseconds
}

// SessionWithMessagesResponse combines SessionResponse with its messages.
type SessionWithMessagesResponse struct {
	SessionResponse
	Messages []MessageResponse `json:"messages"`
}

func toSessionResponse(session models.ChatSession) SessionResponse {
	return SessionResponse{
		ID:        session.ID,
		Title:     session.Title,
		CreatedAt: session.CreatedAt.UnixMilli(),
	}
}

func toMessageResponse(message models.ChatMessage) MessageResponse {
	tabID := message.TabID
	if tabID == "" {
		tabID = "main"
	}
	return MessageResponse{
		ID:               message.ID,
		TabID:            tabID,
		SortOrder:        message.SortOrder,
		Sender:           message.Sender,
		Text:             message.Text,
		IsReasoning:      message.IsReasoning,
		ReasoningStatus:  message.ReasoningStatus,
		ReasoningSummary: message.ReasoningSummary,
		CreatedAt:        message.CreatedAt.UnixMilli(),
	}
}

// listSessions handles GET /api/sessions
func (h *sessionHandler) listSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := h.sessionRepo.FindAll()
	if err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusInternalServerError, "Failed to retrieve sessions"))
		return
	}

	resp := make([]SessionResponse, len(sessions))
	for i, s := range sessions {
		resp[i] = toSessionResponse(s)
	}
	WriteJSON(log.Logger, w, resp)
}

// createSession handles POST /api/sessions
func (h *sessionHandler) createSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title *string `json:"title"` // Use pointer to differentiate between "empty string" and "not provided"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusBadRequest, "Invalid request payload"))
		return
	}

	session := models.ChatSession{}
	if req.Title != nil {
		session.Title = *req.Title
	} else {
		session.Title = "New operation" // Default title
	}

	createdSession, err := h.sessionRepo.Create(session)
	if err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusInternalServerError, "Failed to create session"))
		return
	}

	WriteJSON(log.Logger, w, toSessionResponse(*createdSession))
}

func (h *sessionHandler) getSession(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "sessionID")
	log.Debug().Str("sessionIDRaw", sessionIDStr).Msg("Attempting to parse session ID")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusBadRequest, "Invalid session ID"))
		return
	}

	session, err := h.sessionRepo.FindByID(sessionID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			WriteError(log.Logger, w, errs.NewApiErr(http.StatusNotFound, "Session not found"))
		} else {
			WriteError(log.Logger, w, errs.NewApiErr(http.StatusInternalServerError, "Failed to retrieve session"))
		}
		return
	}

	messages, err := h.messageRepo.FindBySessionID(sessionID)
	if err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusInternalServerError, "Failed to retrieve messages for session"))
		return
	}

	messageResponses := make([]MessageResponse, len(messages))
	for i, m := range messages {
		messageResponses[i] = toMessageResponse(m)
	}

	resp := SessionWithMessagesResponse{
		SessionResponse: toSessionResponse(*session),
		Messages:        messageResponses,
	}
	WriteJSON(log.Logger, w, resp)
}

// updateSessionTitle handles PATCH /api/sessions/{sessionID}
func (h *sessionHandler) updateSessionTitle(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "sessionID"))
	if err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusBadRequest, "Invalid session ID"))
		return
	}

	var req struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusBadRequest, "Invalid request payload"))
		return
	}

	if err := h.sessionRepo.UpdateTitle(sessionID, req.Title); err != nil {
		if err == gorm.ErrRecordNotFound {
			WriteError(log.Logger, w, errs.NewApiErr(http.StatusNotFound, "Session not found"))
		} else {
			WriteError(log.Logger, w, errs.NewApiErr(http.StatusInternalServerError, "Failed to update session title"))
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// summarizeSessionTitle handles POST /api/sessions/{sessionID}/summarize
func (h *sessionHandler) summarizeSessionTitle(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "sessionID"))
	if err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusBadRequest, "Invalid session ID"))
		return
	}

	messages, err := h.messageRepo.FindMainBySessionID(sessionID)
	if err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusInternalServerError, "Failed to retrieve messages for session"))
		return
	}

	if len(messages) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var history []services.ConversationTurn
	for _, msg := range messages {
		role := ""
		switch msg.Sender {
		case "SNAKE": // Assuming SNAKE is the user
			role = "user"
		case "COLONEL": // Assuming COLONEL is the assistant
			role = "assistant"
		default:
			continue // Skip other message types
		}
		history = append(history, services.ConversationTurn{Role: role, Content: msg.Text})
	}

	if len(history) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	summarizedTitle, err := h.llmClient.SummarizeChatTitle(history)
	if err != nil {
		log.Error().Err(err).Msg("Failed to summarize chat title with LLM")
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusInternalServerError, "Failed to generate title"))
		return
	}

	// Update the session title in the database
	if err := h.sessionRepo.UpdateTitle(sessionID, summarizedTitle); err != nil {
		log.Error().Err(err).Str("sessionID", sessionID.String()).Msg("Failed to update session title in DB after summarization")
		if err == gorm.ErrRecordNotFound {
			WriteError(log.Logger, w, errs.NewApiErr(http.StatusNotFound, "Session not found for title update"))
		} else {
			WriteError(log.Logger, w, errs.NewApiErr(http.StatusInternalServerError, "Failed to update session title in DB"))
		}
		return
	}

	WriteJSON(log.Logger, w, map[string]string{"title": summarizedTitle})
}

// deleteSession handles DELETE /api/sessions/{sessionID}
func (h *sessionHandler) deleteSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "sessionID"))
	if err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusBadRequest, "Invalid session ID"))
		return
	}

	if err := h.sessionRepo.Delete(sessionID); err != nil {
		if err == gorm.ErrRecordNotFound {
			WriteError(log.Logger, w, errs.NewApiErr(http.StatusNotFound, "Session not found"))
		} else {
			WriteError(log.Logger, w, errs.NewApiErr(http.StatusInternalServerError, "Failed to delete session"))
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// SessionCompetitorsResponse is the response for GET /sessions/{sessionID}/competitors.
type SessionCompetitorsResponse struct {
	Competitors []CompetitorItem      `json:"competitors"`
	Dossier     *IntelDossierResponse `json:"dossier,omitempty"`
}

// getSessionCompetitors handles GET /sessions/{sessionID}/competitors
func (h *sessionHandler) getSessionCompetitors(w http.ResponseWriter, r *http.Request) {
	sessionID, err := uuid.Parse(chi.URLParam(r, "sessionID"))
	if err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusBadRequest, "Invalid session ID"))
		return
	}

	links, err := h.sessionCompetitorRepo.FindBySessionID(sessionID)
	if err != nil {
		WriteError(log.Logger, w, errs.NewApiErr(http.StatusInternalServerError, "Failed to retrieve session competitors"))
		return
	}

	competitors := make([]CompetitorItem, 0, len(links))
	var firstCompanyID *uuid.UUID
	for _, link := range links {
		comp, err := h.competitorRepo.FindByID(link.CompetitorID)
		if err != nil || comp == nil {
			continue
		}
		competitors = append(competitors, CompetitorItem{
			ID:          comp.ID.String(),
			Name:        comp.Name,
			ThreatLevel: comp.ThreatLevel,
			Status:      comp.Status,
			Intel:       comp.Intel,
		})
		if firstCompanyID == nil {
			cid := comp.CompanyID
			firstCompanyID = &cid
		}
	}

	resp := SessionCompetitorsResponse{Competitors: competitors}

	if firstCompanyID != nil {
		dossier, err := h.dossierRepo.FindByCompanyID(*firstCompanyID)
		if err == nil && dossier != nil {
			resp.Dossier = buildDossierResponse(dossier)
		}
	}

	WriteJSON(log.Logger, w, resp)
}
