package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/rpupo63/report-backend/database"
	"github.com/rpupo63/report-backend/errs"
	"github.com/rpupo63/report-backend/models"
	"github.com/rpupo63/report-backend/services"
	"github.com/rs/zerolog/log"

	"github.com/google/uuid"
)

type chatHandler struct {
	companyRepo           database.CompanyRepoInterface
	competitorRepo        database.CompetitorRepoInterface
	dossierRepo           database.IntelDossierRepoInterface
	sessionRepo           database.ChatSessionRepoInterface
	messageRepo           database.ChatMessageRepoInterface
	sessionCompetitorRepo database.SessionCompetitorRepoInterface
	strategyAgent         *services.StrategyAgent
}

func newChatHandler(
	companyRepo database.CompanyRepoInterface,
	competitorRepo database.CompetitorRepoInterface,
	dossierRepo database.IntelDossierRepoInterface,
	sessionRepo database.ChatSessionRepoInterface,
	messageRepo database.ChatMessageRepoInterface,
	sessionCompetitorRepo database.SessionCompetitorRepoInterface,
	strategyAgent *services.StrategyAgent,
) chatHandler {
	return chatHandler{
		companyRepo:           companyRepo,
		competitorRepo:        competitorRepo,
		dossierRepo:           dossierRepo,
		sessionRepo:           sessionRepo,
		messageRepo:           messageRepo,
		sessionCompetitorRepo: sessionCompetitorRepo,
		strategyAgent:         strategyAgent,
	}
}

// Wire types — JSON field names must match TypeScript interfaces exactly.

type ChatRequest struct {
	Message           string                      `json:"message"`
	Frequency         string                      `json:"frequency,omitempty"`
	CompanyIdentifier string                      `json:"company_identifier,omitempty"` // optional explicit identifier for the agent
	History           []services.ConversationTurn `json:"history,omitempty"`
	SessionID         string                      `json:"session_id,omitempty"`
}

type ReasoningStep struct {
	Step    string `json:"step"`
	Summary string `json:"summary"`
	Status  string `json:"status"`
}

type CompetitorItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ThreatLevel string `json:"threat_level"`
	Status      string `json:"status"`
	Intel       string `json:"intel"`
}

type DossierMatrixItem struct {
	Name           string `json:"name"`
	ThreatLevel    string `json:"threat_level"`
	MarketShare    string `json:"marketShare"`
	KeyStrength    string `json:"keyStrength"`
	PrimaryProduct string `json:"primaryProduct"`
	AICapability   string `json:"aiCapability"`
}

type ChallengeItem struct {
	Competitor string   `json:"competitor"`
	Gaps       []string `json:"gaps"`
}

type StrikePlanItem struct {
	Codename  string `json:"codename"`
	Objective string `json:"objective"`
	Target    string `json:"target"`
	Approach  string `json:"approach"`
	Timeline  string `json:"timeline"`
	Priority  string `json:"priority"`
}

type IntelDossierResponse struct {
	Classification string              `json:"classification"`
	TargetCompany  string              `json:"targetCompany"`
	OperationName  string              `json:"operationName"`
	DateCompiled   string              `json:"dateCompiled"`
	Matrix         []DossierMatrixItem `json:"matrix"`
	Challenges     []ChallengeItem     `json:"challenges"`
	StrikePlan     []StrikePlanItem    `json:"strikePlan"`
}

type IdentifyResponse struct {
	UserInput   string `json:"userInput"`
	CompanyName string `json:"companyName"`
	ProfileURL  string `json:"profileURL"`
}

type ChatResponse struct {
	Reasoning     []ReasoningStep       `json:"reasoning"`
	FinalAnalysis string                `json:"finalAnalysis"`
	IntelLevel    int                   `json:"intelLevel"`
	TokensUsed    int                   `json:"tokensUsed"`
	Competitors   []CompetitorItem      `json:"competitors"`
	Dossier       *IntelDossierResponse `json:"dossier,omitempty"`
}

var staticReasoning = []ReasoningStep{
	{Step: "Intercepting corporate frequencies...", Summary: "Scanning all known corporate communication bands for signals matching entity identifiers and registered trade names.", Status: "complete"},
	{Step: "Accessing DARPA shadow-net...", Summary: "Querying classified industry databases including SEC filings, patent registries, and M&A records to verify corporate structure.", Status: "complete"},
	{Step: "Cross-referencing market intelligence...", Summary: "Comparing product lines, revenue segments, and market positioning against all entities in adjacent sectors to identify direct rivalries.", Status: "complete"},
	{Step: "Compiling target dossiers...", Summary: "Aggregating threat assessments, market share data, and strategic postures for each confirmed competitor into actionable briefings.", Status: "complete"},
}

func (h chatHandler) handleChatIdentify() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			WriteError(log.Logger, w, errs.BadRequest("invalid request body"))
			return
		}

		result, err := h.strategyAgent.IdentifyCompany(req.Message, req.History)
		if err != nil {
			WriteError(log.Logger, w, err)
			return
		}

		resp := IdentifyResponse{
			UserInput:   result.UserInput,
			CompanyName: result.CompanyName,
			ProfileURL:  result.ProfileURL,
		}

		WriteJSON(log.Logger, w, resp)
	}
}

var agentReasoning = []ReasoningStep{
	{Step: "Parsing strategic intent...", Summary: "Extracting company identifier and focus areas from request using LLM intent extraction.", Status: "complete"},
	{Step: "Gathering company intelligence...", Summary: "Discovering similar companies and gathering structural data (headcount, revenue, tech stack) via concurrent company data enrichment requests.", Status: "complete"},
	{Step: "Executing web reconnaissance...", Summary: "Running parallel web searches per competitor — news, pricing reviews, and alternative queries.", Status: "complete"},
	{Step: "AI synthesis in progress...", Summary: "LLM synthesizing raw data into structured competitor intelligence with competitive assessments and challenges.", Status: "complete"},
	{Step: "Generating battle plan...", Summary: "Formulating final strategic recommendations and validating actionability via secondary LLM evaluation.", Status: "complete"},
}

func (h chatHandler) handleChat() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			WriteError(log.Logger, w, errs.BadRequest("invalid request body"))
			return
		}

		company, err := h.companyRepo.FindByMessageSubstring(req.Message)
		if err != nil {
			WriteError(log.Logger, w, err)
			return
		}

		// Company not in DB — run the live strategy agent pipeline.
		if company == nil && h.strategyAgent != nil {
			identifier := req.Message
			if req.CompanyIdentifier != "" {
				identifier = req.CompanyIdentifier
			}

			agentResult, err := h.strategyAgent.Run(identifier, req.Message, nil, req.History)
			if err != nil {
				WriteError(log.Logger, w, err)
				return
			}

			competitors := make([]CompetitorItem, 0, len(agentResult.Competitors))
			for _, c := range agentResult.Competitors {
				competitors = append(competitors, CompetitorItem{
					ID:          c.ID.String(),
					Name:        c.Name,
					ThreatLevel: c.ThreatLevel,
					Status:      c.Status,
					Intel:       c.Intel,
				})
			}

			resp := ChatResponse{

				Reasoning: agentReasoning,

				Competitors: competitors,

				FinalAnalysis: agentResult.FinalAnalysis,

				IntelLevel: agentResult.IntelLevel,

				TokensUsed: agentResult.TokensUsed,
			}

			if agentResult.Dossier != nil {

				// Re-fetch with full relation preloads so the response is complete.

				dossier, _ := h.dossierRepo.FindByCompanyID(agentResult.Company.ID)

				if dossier != nil {

					resp.Dossier = buildDossierResponse(dossier)

				}

			}

			WriteJSON(log.Logger, w, resp)

			return

		}

		if company == nil {

			WriteError(log.Logger, w, errs.NewNotFound("company"))

			return

		}

		dbCompetitors, err := h.competitorRepo.FindByCompanyID(company.ID)

		if err != nil {

			WriteError(log.Logger, w, err)

			return

		}

		dossier, err := h.dossierRepo.FindByCompanyID(company.ID)

		if err != nil {

			WriteError(log.Logger, w, err)

			return

		}

		competitors := make([]CompetitorItem, 0, len(dbCompetitors))

		for _, c := range dbCompetitors {

			competitors = append(competitors, CompetitorItem{

				ID: c.ID.String(),

				Name: c.Name,

				ThreatLevel: c.ThreatLevel,

				Status: c.Status,

				Intel: c.Intel,
			})

		}

		resp := ChatResponse{

			Reasoning: []ReasoningStep{},

			Competitors: competitors,

			IntelLevel: 64,

			TokensUsed: 0, // Fast path: no LLM calls

		}

		if len(dbCompetitors) > 0 {
			resp.FinalAnalysis = "Analyst, we've gathered initial intelligence on " + company.Name + ". " +
				"Potential competitors have been identified. Select a company for a detailed report."
			resp.IntelLevel = 64
		}

		if dossier != nil {
			resp.Dossier = buildDossierResponse(dossier)
		}

		WriteJSON(log.Logger, w, resp)
	}
}

// sseEvent is the envelope sent over the SSE stream.
type sseEvent struct {
	Type    string        `json:"type"`
	Step    string        `json:"step,omitempty"`
	Summary string        `json:"summary,omitempty"`
	Status  string        `json:"status,omitempty"`
	Payload *ChatResponse `json:"payload,omitempty"`
	Error   string        `json:"error,omitempty"`
}

// writeSSE serialises v as a single SSE data line and flushes.
func writeSSE(w http.ResponseWriter, f http.Flusher, v interface{}) {
	data, _ := json.Marshal(v)
	fmt.Fprintf(w, "data: %s\n\n", data)
	f.Flush()
}

func (h chatHandler) handleChatStream() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		var req ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeSSE(w, flusher, sseEvent{Type: "error", Error: "invalid request body"})
			return
		}

		sessionID, history, nextOrder, isNewSession := h.resolveSessionAndHistory(req.SessionID, req.History)
		var shouldPersistSession bool
		if sessionID != uuid.Nil && len(req.History) == 0 && len(history) > 0 && req.CompanyIdentifier == "" {
			req.History = history
		}

		// Competitor tab fast path: if a company_identifier is set, the message
		// originates from a competitor tab. Load the competitor's stored intel
		// from the DB and answer conversationally — never trigger the full pipeline.
		if req.CompanyIdentifier != "" && h.strategyAgent != nil {
			shouldPersistSession = true // Company is explicitly identified
			context := h.buildCompetitorContext(req.CompanyIdentifier)
			if context != "" {
				enrichedHistory := append(
					[]services.ConversationTurn{{Role: "user", Content: "Intelligence file:\n" + context}},
					req.History...,
				)

				writeSSE(w, flusher, sseEvent{Type: "step", Step: "Analyzing transmission...", Summary: "Processing follow-up query using competitor intel.", Status: "pending"})
				time.Sleep(400 * time.Millisecond)
				writeSSE(w, flusher, sseEvent{Type: "step", Step: "Analyzing transmission...", Summary: "Context analysis complete.", Status: "complete"})

				reply, tokensUsed, err := h.strategyAgent.GenerateConversationalResponse(enrichedHistory, req.Message)
				if err != nil {
					writeSSE(w, flusher, sseEvent{Type: "error", Error: "failed to generate response"})
					return
				}

				resp := ChatResponse{
					Reasoning:     []ReasoningStep{{Step: "Analyzing transmission...", Summary: "Context analysis complete.", Status: "complete"}},
					FinalAnalysis: reply,
					Competitors:   []CompetitorItem{},
					IntelLevel:    50,
					TokensUsed:    tokensUsed,
				}
				writeSSE(w, flusher, sseEvent{Type: "done", Payload: &resp})

				// Persistence logic for this path
				if isNewSession && shouldPersistSession {
					session := models.ChatSession{ID: sessionID, Title: "New operation"}
					_, err := h.sessionRepo.Create(session)
					if err != nil {
						log.Error().Err(err).Str("sessionID", sessionID.String()).Msg("Failed to create new session")
					}
				}
				if shouldPersistSession {
					h.persistTurn(sessionID, req.Message, resp.FinalAnalysis, nextOrder, req.CompanyIdentifier)
					h.persistCompetitorLinks(sessionID, resp)
				}
				return
			}
		}

		// Intent pre-routing: if history exists, check if this is a follow-up.
		if len(req.History) > 0 && h.strategyAgent != nil {
			intent := h.strategyAgent.ClassifyIntent(req.History, req.Message)
			if intent == "followup" || intent == "general" {
				shouldPersistSession = true // Follow-up messages should be persisted
				writeSSE(w, flusher, sseEvent{Type: "step", Step: "Analyzing transmission...", Summary: "Processing follow-up query using conversation context.", Status: "pending"})
				time.Sleep(400 * time.Millisecond)
				writeSSE(w, flusher, sseEvent{Type: "step", Step: "Analyzing transmission...", Summary: "Context analysis complete.", Status: "complete"})

				conversationalReply, tokensUsed, err := h.strategyAgent.GenerateConversationalResponse(req.History, req.Message)
				if err != nil {
					writeSSE(w, flusher, sseEvent{Type: "error", Error: "failed to generate response"})
					return
				}

				resp := ChatResponse{
					Reasoning:     []ReasoningStep{{Step: "Analyzing transmission...", Summary: "Context analysis complete.", Status: "complete"}},
					FinalAnalysis: conversationalReply,
					Competitors:   []CompetitorItem{},
					IntelLevel:    50,
					TokensUsed:    tokensUsed,
				}
				writeSSE(w, flusher, sseEvent{Type: "done", Payload: &resp})

				// Persistence logic for this path
				if isNewSession && shouldPersistSession {
					session := models.ChatSession{ID: sessionID, Title: "New operation"}
					_, err := h.sessionRepo.Create(session)
					if err != nil {
						log.Error().Err(err).Str("sessionID", sessionID.String()).Msg("Failed to create new session")
					}
				}
				if shouldPersistSession {
					h.persistTurn(sessionID, req.Message, resp.FinalAnalysis, nextOrder, req.CompanyIdentifier)
					h.persistCompetitorLinks(sessionID, resp)
				}
				return
			}
		}
		company, _ := h.companyRepo.FindByMessageSubstring(req.Message)
		if company != nil {
			shouldPersistSession = true // Mark for persistence

			for _, step := range staticReasoning {
				writeSSE(w, flusher, sseEvent{Type: "step", Step: step.Step, Summary: step.Summary, Status: "pending"})
				time.Sleep(600 * time.Millisecond)
				writeSSE(w, flusher, sseEvent{Type: "step", Step: step.Step, Summary: step.Summary, Status: "complete"})
			}

			dbCompetitors, _ := h.competitorRepo.FindByCompanyID(company.ID)
			dossier, _ := h.dossierRepo.FindByCompanyID(company.ID)

			competitors := make([]CompetitorItem, 0, len(dbCompetitors))
			for _, c := range dbCompetitors {
				competitors = append(competitors, CompetitorItem{
					ID:          c.ID.String(),
					Name:        c.Name,
					ThreatLevel: c.ThreatLevel,
					Status:      c.Status,
					Intel:       c.Intel,
				})
			}

			finalAnalysis := ""
			if len(dbCompetitors) > 0 {
				finalAnalysis = "Analyst, we've gathered initial intelligence on " + company.Name + ". " +
					"Potential competitors have been identified. Select a company for a detailed report."
			}

			resp := ChatResponse{
				Reasoning:     staticReasoning,
				Competitors:   competitors,
				IntelLevel:    64,
				TokensUsed:    0, // Fast path: no LLM calls
				FinalAnalysis: finalAnalysis,
			}

			if dossier != nil {
				resp.Dossier = buildDossierResponse(dossier)
			}

			writeSSE(w, flusher, sseEvent{Type: "done", Payload: &resp})

			// Persistence logic for this path
			if isNewSession && shouldPersistSession {
				session := models.ChatSession{ID: sessionID, Title: "New operation"}
				if resp.Dossier != nil && resp.Dossier.TargetCompany != "" {
					session.Title = resp.Dossier.TargetCompany
				}
				_, err := h.sessionRepo.Create(session)
				if err != nil {
					log.Error().Err(err).Str("sessionID", sessionID.String()).Msg("Failed to create new session")
				}
			}
			if shouldPersistSession {
				h.persistTurn(sessionID, req.Message, resp.FinalAnalysis, nextOrder, req.CompanyIdentifier)
				h.persistCompetitorLinks(sessionID, resp)
			}
			return
		}

		// Live path: run agent with a progress channel.
		if h.strategyAgent == nil {
			writeSSE(w, flusher, sseEvent{Type: "error", Error: "strategy agent not configured"})
			return
		}

		identifier := req.Message
		if req.CompanyIdentifier != "" {
			identifier = req.CompanyIdentifier
		}

		progressCh := make(chan services.ProgressEvent, 20)
		type agentOutcome struct {
			result *services.AgentResult
			err    error
		}
		doneCh := make(chan agentOutcome, 1)

		go func() {
			result, err := h.strategyAgent.Run(identifier, req.Message, progressCh, req.History)
			close(progressCh)
			doneCh <- agentOutcome{result, err}
		}()

		for pe := range progressCh {
			writeSSE(w, flusher, sseEvent{Type: "step", Step: pe.Step, Summary: pe.Summary, Status: pe.Status})
		}

		outcome := <-doneCh
		if outcome.err != nil {
			writeSSE(w, flusher, sseEvent{Type: "error", Error: outcome.err.Error()})
			return
		}

		agentResult := outcome.result
		if agentResult.Company != nil { // Check if the agent found a company
			shouldPersistSession = true
		}
		competitors := make([]CompetitorItem, 0, len(agentResult.Competitors))
		for _, c := range agentResult.Competitors {
			competitors = append(competitors, CompetitorItem{
				ID:          c.ID.String(),
				Name:        c.Name,
				ThreatLevel: c.ThreatLevel,
				Status:      c.Status,
				Intel:       c.Intel,
			})
		}

		resp := ChatResponse{
			Reasoning:     agentReasoning,
			Competitors:   competitors,
			FinalAnalysis: agentResult.FinalAnalysis,
			IntelLevel:    agentResult.IntelLevel,
			TokensUsed:    agentResult.TokensUsed,
		}

		if agentResult.Dossier != nil {
			dossier, _ := h.dossierRepo.FindByCompanyID(agentResult.Company.ID)
			if dossier != nil {
				resp.Dossier = buildDossierResponse(dossier)
			}
		}

		writeSSE(w, flusher, sseEvent{Type: "done", Payload: &resp})

		// The persistence is moved to the end of the handleChatStream function
		// Consolidate persistence logic here
		if isNewSession && shouldPersistSession {
			session := models.ChatSession{
				ID:    sessionID,
				Title: "New operation", // Default title, will be updated by persistCompetitorLinks if dossier is present
			}
			_, err := h.sessionRepo.Create(session)
			if err != nil {
				log.Error().Err(err).Str("sessionID", sessionID.String()).Msg("Failed to create new session after company identification")
				// Optionally, write an error to the SSE stream or log it more critically
			}
		}

		if shouldPersistSession {
			h.persistTurn(sessionID, req.Message, resp.FinalAnalysis, nextOrder, req.CompanyIdentifier)
			h.persistCompetitorLinks(sessionID, resp)
		}
	}
}

// resolveSessionAndHistory parses the sessionID and loads history if needed.
func (h *chatHandler) resolveSessionAndHistory(sessionIDStr string, currentHistory []services.ConversationTurn) (uuid.UUID, []services.ConversationTurn, int, bool) {
	var isNewSession bool
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		// Invalid session ID, generate a new one for the in-memory session
		sessionID = uuid.New()
		isNewSession = true
	}

	nextOrder, err := h.messageRepo.NextSortOrder(sessionID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get next sort order for messages")
		return uuid.Nil, nil, 0, isNewSession
	}

	// If history is empty, try to load from DB (main tab only — competitor tabs must not pollute LLM context)
	if len(currentHistory) == 0 {
		messages, err := h.messageRepo.FindMainBySessionID(sessionID)
		if err != nil {
			log.Error().Err(err).Str("sessionID", sessionID.String()).Msg("Failed to load messages for session")
			return sessionID, nil, nextOrder, isNewSession
		}

		history := make([]services.ConversationTurn, 0, len(messages))
		for _, msg := range messages {
			role := ""
			switch msg.Sender {
			case "SNAKE":
				role = "user"
			case "COLONEL":
				role = "assistant"
			default:
				continue // Don't include SYSTEM/INTEL messages in LLM history
			}
			history = append(history, services.ConversationTurn{Role: role, Content: msg.Text})
		}
		return sessionID, history, nextOrder, isNewSession
	}

	return sessionID, currentHistory, nextOrder, isNewSession
}

// persistTurn saves the user and assistant messages for a session.
func (h *chatHandler) persistTurn(sessionID uuid.UUID, userMessage, assistantMessage string, nextOrder int, tabID string) {
	if sessionID == uuid.Nil {
		return // No-op if no valid session
	}
	if tabID == "" {
		tabID = "main"
	}

	userMsg := models.ChatMessage{
		SessionID: sessionID,
		TabID:     tabID,
		SortOrder: nextOrder,
		Sender:    "SNAKE", // User message
		Text:      userMessage,
		CreatedAt: time.Now(),
	}
	if _, err := h.messageRepo.Add(userMsg); err != nil {
		log.Error().Err(err).Str("sessionID", sessionID.String()).Msg("Failed to persist user message")
	}

	assistantMsg := models.ChatMessage{
		SessionID: sessionID,
		TabID:     tabID,
		SortOrder: nextOrder + 1,
		Sender:    "COLONEL", // Assistant message
		Text:      assistantMessage,
		CreatedAt: time.Now(),
	}
	if _, err := h.messageRepo.Add(assistantMsg); err != nil {
		log.Error().Err(err).Str("sessionID", sessionID.String()).Msg("Failed to persist assistant message")
	}
}

// persistCompetitorLinks saves session-competitor associations and auto-updates the session title.
func (h *chatHandler) persistCompetitorLinks(sessionID uuid.UUID, resp ChatResponse) {
	if sessionID == uuid.Nil || h.sessionCompetitorRepo == nil {
		return
	}

	for _, comp := range resp.Competitors {
		competitorID, err := uuid.Parse(comp.ID)
		if err != nil {
			log.Error().Err(err).Str("competitorID", comp.ID).Msg("Failed to parse competitor UUID")
			continue
		}
		exists, err := h.sessionCompetitorRepo.Exists(sessionID, competitorID)
		if err != nil {
			log.Error().Err(err).Msg("Failed to check session-competitor existence")
			continue
		}
		if !exists {
			sc := models.SessionCompetitor{
				SessionID:    sessionID,
				CompetitorID: competitorID,
			}
			if err := h.sessionCompetitorRepo.Add(sc); err != nil {
				log.Error().Err(err).Msg("Failed to add session-competitor link")
			}
		}
	}

	if resp.Dossier != nil && resp.Dossier.TargetCompany != "" {
		if err := h.sessionRepo.UpdateTitle(sessionID, resp.Dossier.TargetCompany); err != nil {
			log.Error().Err(err).Msg("Failed to auto-update session title from dossier")
		}
	}
}

// buildCompetitorContext loads a competitor by UUID and returns a structured
// intel summary string for use as LLM context. Returns empty string if the
// UUID is invalid or the competitor is not found.
func (h *chatHandler) buildCompetitorContext(competitorIDStr string) string {
	id, err := uuid.Parse(competitorIDStr)
	if err != nil {
		return ""
	}

	c, err := h.competitorRepo.FindByID(id)
	if err != nil || c == nil {
		return ""
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Competitor: %s\n", c.Name))
	sb.WriteString(fmt.Sprintf("Threat Level: %s\n", c.ThreatLevel))
	sb.WriteString(fmt.Sprintf("Status: %s\n", c.Status))
	sb.WriteString(fmt.Sprintf("Intel: %s\n", c.Intel))
	sb.WriteString(fmt.Sprintf("Market Share: %s\n", c.MarketShare))
	sb.WriteString(fmt.Sprintf("Final Analysis: %s\n", c.FinalAnalysis))
	sb.WriteString(fmt.Sprintf("Recommendation: %s\n", c.Recommendation))

	if len(c.KeyProducts) > 0 {
		products := make([]string, 0, len(c.KeyProducts))
		for _, kp := range c.KeyProducts {
			products = append(products, kp.Value)
		}
		sb.WriteString(fmt.Sprintf("Key Products: %s\n", strings.Join(products, ", ")))
	}

	if len(c.Challenges) > 0 {
		challenges := make([]string, 0, len(c.Challenges))
		for _, ch := range c.Challenges {
			challenges = append(challenges, ch.Value)
		}
		sb.WriteString(fmt.Sprintf("Challenges: %s\n", strings.Join(challenges, ", ")))
	}

	return sb.String()
}

// buildDossierResponse converts a models.IntelDossier (with preloaded relations)
// into the wire type sent to the frontend.
func buildDossierResponse(dossier *models.IntelDossier) *IntelDossierResponse {
	d := &IntelDossierResponse{
		Classification: dossier.Classification,
		TargetCompany:  dossier.TargetCompany,
		OperationName:  dossier.OperationName,
		DateCompiled:   dossier.DateCompiled,
		Matrix:         make([]DossierMatrixItem, 0, len(dossier.Matrix)),
		Challenges:     make([]ChallengeItem, 0, len(dossier.Challenges)),
	}
	for _, m := range dossier.Matrix {
		d.Matrix = append(d.Matrix, DossierMatrixItem{
			Name:           m.Name,
			ThreatLevel:    m.ThreatLevel,
			MarketShare:    m.MarketShare,
			KeyStrength:    m.KeyStrength,
			PrimaryProduct: m.PrimaryProduct,
			AICapability:   m.AICapability,
		})
	}
	for _, c := range dossier.Challenges {
		gaps := make([]string, 0, len(c.Gaps))
		for _, g := range c.Gaps {
			gaps = append(gaps, g.Value)
		}
		d.Challenges = append(d.Challenges, ChallengeItem{
			Competitor: c.Competitor,
			Gaps:       gaps,
		})
	}
	for _, sp := range dossier.StrikePlan {
		d.StrikePlan = append(d.StrikePlan, StrikePlanItem{
			Codename:  sp.Codename,
			Objective: sp.Objective,
			Target:    sp.Target,
			Approach:  sp.Approach,
			Timeline:  sp.Timeline,
			Priority:  sp.Priority,
		})
	}
	return d
}
