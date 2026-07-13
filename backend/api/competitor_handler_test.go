package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rpupo63/report-backend/models"
	"github.com/rpupo63/report-backend/services/fakes"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newCompetitorTestRouter(repo *memCompetitorRepo) *chi.Mux {
	h := newCompetitorHandler(repo, fakes.NewFakeSerp(), fakes.NewFakeEnrich(), fakes.NewFakeLLM())
	router := chi.NewRouter()
	router.Get("/competitors/{competitorID}", h.getDrilldown())
	return router
}

func getDrilldownResponse(t *testing.T, router *chi.Mux, id string) (*httptest.ResponseRecorder, CompetitorDrilldownResponse) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/competitors/"+id, nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	var resp CompetitorDrilldownResponse
	if rr.Code == http.StatusOK {
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
	}
	return rr, resp
}

func TestGetDrilldown_InvalidID(t *testing.T) {
	router := newCompetitorTestRouter(&memCompetitorRepo{})
	rr, _ := getDrilldownResponse(t, router, "not-a-uuid")
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestGetDrilldown_NotFound(t *testing.T) {
	router := newCompetitorTestRouter(&memCompetitorRepo{})
	rr, _ := getDrilldownResponse(t, router, uuid.NewString())
	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestGetDrilldown_AlreadyFetched(t *testing.T) {
	repo := &memCompetitorRepo{}
	competitor := models.Competitor{
		CompanyID:      uuid.New(),
		Name:           "Coyote Corp",
		ThreatLevel:    "HIGH",
		Status:         "Analyzed",
		Intel:          "existing intel",
		MarketShare:    "23%",
		FinalAnalysis:  "existing analysis",
		IntelLevel:     70,
		Recommendation: "hold position",
		SerpFetched:    true,
	}
	require.NoError(t, repo.CreateCompetitor(&competitor))
	require.NoError(t, repo.AddKeyProduct(models.CompetitorKeyProduct{CompetitorID: competitor.ID, Value: "Rocket Skates"}))
	require.NoError(t, repo.AddChallenge(models.CompetitorChallenge{CompetitorID: competitor.ID, Value: "Gravity"}))
	require.NoError(t, repo.AddReasoning(models.CompetitorReasoning{CompetitorID: competitor.ID, Step: "Initial Scan", Summary: "done", Status: "complete", SortOrder: 1}))

	router := newCompetitorTestRouter(repo)
	rr, resp := getDrilldownResponse(t, router, competitor.ID.String())

	require.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "existing analysis", resp.FinalAnalysis)
	assert.Equal(t, 70, resp.IntelLevel)
	assert.Equal(t, "23%", resp.Details.MarketShare)
	assert.Equal(t, []string{"Rocket Skates"}, resp.Details.KeyProducts)
	assert.Equal(t, []string{"Gravity"}, resp.Details.Challenges)
	assert.Equal(t, "hold position", resp.Details.Recommendation)
	require.Len(t, resp.Reasoning, 1)
	assert.Equal(t, "Initial Scan", resp.Reasoning[0].Step)
}

func TestGetDrilldown_TriggersSerpEnrichmentWhenNotFetched(t *testing.T) {
	repo := &memCompetitorRepo{}
	competitor := models.Competitor{
		CompanyID:   uuid.New(),
		Name:        "Globex Corporation",
		ThreatLevel: "MODERATE",
		Status:      "Analyzed",
		SerpFetched: false,
	}
	require.NoError(t, repo.CreateCompetitor(&competitor))

	router := newCompetitorTestRouter(repo)
	rr, resp := getDrilldownResponse(t, router, competitor.ID.String())

	require.Equal(t, http.StatusOK, rr.Code)

	// The fake LLM synthesis drives the persisted update.
	assert.Equal(t, "12%", resp.Details.MarketShare)
	assert.Contains(t, resp.Details.Recommendation, "Undercut")
	assert.Contains(t, resp.Details.KeyProducts, "Globex Corporation Core")
	assert.Contains(t, resp.Details.Challenges, "Legacy architecture")
	assert.Equal(t, 87, resp.IntelLevel)

	// A "Web Reconnaissance" reasoning step is recorded.
	foundRecon := false
	for _, step := range resp.Reasoning {
		if step.Step == "Web Reconnaissance" {
			foundRecon = true
		}
	}
	assert.True(t, foundRecon, "expected a Web Reconnaissance reasoning step")

	// And the competitor is now marked as fetched.
	updated, err := repo.FindByID(competitor.ID)
	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.True(t, updated.SerpFetched)
	assert.Equal(t, "HIGH", updated.ThreatLevel)
}
