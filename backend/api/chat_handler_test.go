package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/rpupo63/report-backend/models"
	"github.com/rpupo63/report-backend/services"
	"github.com/rpupo63/report-backend/services/fakes"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newChatTestRouter(companyRepo *memCompanyRepo, competitorRepo *memCompetitorRepo, dossierRepo *memDossierRepo) *chi.Mux {
	agent := services.NewStrategyAgent(
		companyRepo,
		competitorRepo,
		dossierRepo,
		fakes.NewFakeLLM(),
		fakes.NewFakeSerp(),
		fakes.NewFakeEnrich(),
	)
	h := newChatHandler(
		companyRepo,
		competitorRepo,
		dossierRepo,
		&memSessionRepo{},
		&memMessageRepo{},
		&memSessionCompetitorRepo{},
		agent,
	)
	router := chi.NewRouter()
	router.Post("/chat", h.handleChat())
	return router
}

func postChat(t *testing.T, router *chi.Mux, body ChatRequest) (*httptest.ResponseRecorder, ChatResponse) {
	t.Helper()
	payload, err := json.Marshal(body)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader(payload))
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	var resp ChatResponse
	if rr.Code == http.StatusOK {
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
	}
	return rr, resp
}

func TestHandleChat_LivePipelineWithFakes(t *testing.T) {
	companyRepo := &memCompanyRepo{}
	competitorRepo := &memCompetitorRepo{}
	dossierRepo := &memDossierRepo{}
	router := newChatTestRouter(companyRepo, competitorRepo, dossierRepo)

	rr, resp := postChat(t, router, ChatRequest{Message: "run a competitive analysis on some unknown startup"})

	require.Equal(t, http.StatusOK, rr.Code)
	assert.Len(t, resp.Competitors, len(fakes.FakeCompetitorNames))
	names := make(map[string]bool)
	for _, c := range resp.Competitors {
		names[c.Name] = true
		assert.NotEmpty(t, c.ID)
		assert.Equal(t, "HIGH", c.ThreatLevel)
	}
	for _, expected := range fakes.FakeCompetitorNames {
		assert.True(t, names[expected], "expected competitor %q in response", expected)
	}

	assert.Contains(t, resp.FinalAnalysis, "Fake Target Inc")
	require.NotNil(t, resp.Dossier)
	assert.Equal(t, "OPERATION PAPER TIGER", resp.Dossier.OperationName)
	assert.Equal(t, "Fake Target Inc", resp.Dossier.TargetCompany)
	assert.NotEmpty(t, resp.Dossier.Matrix)
	assert.NotEmpty(t, resp.Dossier.StrikePlan)

	// Pipeline must have persisted the company, competitors, and dossier.
	company, err := companyRepo.FindByMessageSubstring("Fake Target Inc")
	require.NoError(t, err)
	require.NotNil(t, company)
	persisted, err := competitorRepo.FindByCompanyID(company.ID)
	require.NoError(t, err)
	assert.Len(t, persisted, len(fakes.FakeCompetitorNames))
	dossier, err := dossierRepo.FindByCompanyID(company.ID)
	require.NoError(t, err)
	require.NotNil(t, dossier)
}

func TestHandleChat_KnownCompanyFastPath(t *testing.T) {
	companyRepo := &memCompanyRepo{}
	competitorRepo := &memCompetitorRepo{}
	dossierRepo := &memDossierRepo{}

	company, err := companyRepo.Add(models.Company{Name: "Acme Rockets", Slug: "acme-rockets"})
	require.NoError(t, err)
	require.NoError(t, competitorRepo.CreateCompetitor(&models.Competitor{
		CompanyID:   company.ID,
		Name:        "Coyote Corp",
		ThreatLevel: "HIGH",
		Status:      "Analyzed",
		Intel:       "Known rival",
	}))
	require.NoError(t, dossierRepo.CreateIntelDossier(&models.IntelDossier{
		CompanyID:      company.ID,
		Classification: "Strategic Analysis",
		TargetCompany:  "Acme Rockets",
		OperationName:  "OPERATION ROADRUNNER",
		DateCompiled:   "2026-07-12",
	}))

	router := newChatTestRouter(companyRepo, competitorRepo, dossierRepo)
	rr, resp := postChat(t, router, ChatRequest{Message: "tell me about Acme Rockets"})

	require.Equal(t, http.StatusOK, rr.Code)
	require.Len(t, resp.Competitors, 1)
	assert.Equal(t, "Coyote Corp", resp.Competitors[0].Name)
	assert.Equal(t, 64, resp.IntelLevel)
	assert.Equal(t, 0, resp.TokensUsed, "fast path must not spend LLM tokens")
	require.NotNil(t, resp.Dossier)
	assert.Equal(t, "OPERATION ROADRUNNER", resp.Dossier.OperationName)
}

func TestHandleChat_InvalidBody(t *testing.T) {
	router := newChatTestRouter(&memCompanyRepo{}, &memCompetitorRepo{}, &memDossierRepo{})

	req := httptest.NewRequest(http.MethodPost, "/chat", bytes.NewReader([]byte("{not json")))
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandleChatIdentify_WithFakes(t *testing.T) {
	agent := services.NewStrategyAgent(
		&memCompanyRepo{},
		&memCompetitorRepo{},
		&memDossierRepo{},
		fakes.NewFakeLLM(),
		fakes.NewFakeSerp(),
		fakes.NewFakeEnrich(),
	)
	h := newChatHandler(
		&memCompanyRepo{}, &memCompetitorRepo{}, &memDossierRepo{},
		&memSessionRepo{}, &memMessageRepo{}, &memSessionCompetitorRepo{},
		agent,
	)
	router := chi.NewRouter()
	router.Post("/chat/identify", h.handleChatIdentify())

	payload, _ := json.Marshal(ChatRequest{Message: "who competes with fake target?"})
	req := httptest.NewRequest(http.MethodPost, "/chat/identify", bytes.NewReader(payload))
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp IdentifyResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
	assert.Equal(t, "Fake Target Inc", resp.CompanyName)
	assert.Contains(t, resp.ProfileURL, "linkedin.com/company/")
}
