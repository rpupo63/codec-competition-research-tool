package services_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/rpupo63/report-backend/models"
	"github.com/rpupo63/report-backend/services"
	"github.com/rpupo63/report-backend/services/fakes"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Minimal in-memory repos — just enough for the agent's persistResults step.

type stubCompanyRepo struct{ companies []models.Company }

func (s *stubCompanyRepo) FindAll() ([]models.Company, error) { return s.companies, nil }
func (s *stubCompanyRepo) FindByID(id uuid.UUID) (*models.Company, error) {
	for i := range s.companies {
		if s.companies[i].ID == id {
			return &s.companies[i], nil
		}
	}
	return nil, nil
}
func (s *stubCompanyRepo) FindByMessageSubstring(message string) (*models.Company, error) {
	return nil, nil
}
func (s *stubCompanyRepo) Add(company models.Company) (*models.Company, error) {
	for i := range s.companies {
		if s.companies[i].Slug == company.Slug {
			return &s.companies[i], nil
		}
	}
	company.ID = uuid.New()
	s.companies = append(s.companies, company)
	return &s.companies[len(s.companies)-1], nil
}

type stubCompetitorRepo struct{ created []models.Competitor }

func (s *stubCompetitorRepo) FindByCompanyID(companyID uuid.UUID) ([]models.Competitor, error) {
	return s.created, nil
}
func (s *stubCompetitorRepo) FindByID(id uuid.UUID) (*models.Competitor, error) { return nil, nil }
func (s *stubCompetitorRepo) CreateCompetitor(competitor *models.Competitor) error {
	competitor.ID = uuid.New()
	s.created = append(s.created, *competitor)
	return nil
}
func (s *stubCompetitorRepo) AddKeyProduct(kp models.CompetitorKeyProduct) error { return nil }
func (s *stubCompetitorRepo) AddChallenge(c models.CompetitorChallenge) error    { return nil }
func (s *stubCompetitorRepo) AddReasoning(rn models.CompetitorReasoning) error   { return nil }
func (s *stubCompetitorRepo) DeleteChallengesByCompetitorID(competitorID uuid.UUID) error {
	return nil
}
func (s *stubCompetitorRepo) DeleteKeyProductsByCompetitorID(competitorID uuid.UUID) error {
	return nil
}
func (s *stubCompetitorRepo) DeleteReasoningsByCompetitorID(competitorID uuid.UUID) error {
	return nil
}
func (s *stubCompetitorRepo) UpdateSerpData(id uuid.UUID, intel, marketShare, finalAnalysis, recommendation string, intelLevel int, threatLevel string, serpFetched bool) error {
	return nil
}

type stubDossierRepo struct{ created []models.IntelDossier }

func (s *stubDossierRepo) FindByCompanyID(companyID uuid.UUID) (*models.IntelDossier, error) {
	for i := range s.created {
		if s.created[i].CompanyID == companyID {
			return &s.created[i], nil
		}
	}
	return nil, nil
}
func (s *stubDossierRepo) CreateIntelDossier(dossier *models.IntelDossier) error {
	dossier.ID = uuid.New()
	s.created = append(s.created, *dossier)
	return nil
}
func (s *stubDossierRepo) AddMatrixEntry(entry models.DossierMatrixEntry) error { return nil }
func (s *stubDossierRepo) AddChallenge(v models.DossierChallenge) (*models.DossierChallenge, error) {
	return &v, nil
}
func (s *stubDossierRepo) AddChallengeGap(gap models.DossierChallengeGap) error { return nil }
func (s *stubDossierRepo) AddStrikePlan(sp models.DossierStrikePlan) error      { return nil }

func newAgentWithFakes(companyRepo *stubCompanyRepo, competitorRepo *stubCompetitorRepo, dossierRepo *stubDossierRepo) *services.StrategyAgent {
	return services.NewStrategyAgent(
		companyRepo,
		competitorRepo,
		dossierRepo,
		fakes.NewFakeLLM(),
		fakes.NewFakeSerp(),
		fakes.NewFakeEnrich(),
	)
}

func TestStrategyAgentRun_FullPipeline(t *testing.T) {
	companyRepo := &stubCompanyRepo{}
	competitorRepo := &stubCompetitorRepo{}
	dossierRepo := &stubDossierRepo{}
	agent := newAgentWithFakes(companyRepo, competitorRepo, dossierRepo)

	result, err := agent.Run("", "analyze some startup for me", nil, nil)
	require.NoError(t, err)
	require.NotNil(t, result)

	require.NotNil(t, result.Company)
	assert.Equal(t, "Fake Target Inc", result.Company.Name)

	assert.Len(t, result.Competitors, len(fakes.FakeCompetitorNames))
	for _, c := range result.Competitors {
		assert.Equal(t, "HIGH", c.ThreatLevel)
		assert.True(t, c.SerpFetched, "serp results were gathered, so SerpFetched should be true")
		assert.NotEmpty(t, c.Intel)
	}

	require.NotNil(t, result.Dossier)
	assert.Equal(t, "OPERATION PAPER TIGER", result.Dossier.OperationName)
	assert.Len(t, result.Dossier.Matrix, len(fakes.FakeCompetitorNames))
	assert.NotEmpty(t, result.Dossier.StrikePlan)

	assert.Greater(t, result.TokensUsed, 0)
	assert.NotEmpty(t, result.FinalAnalysis)

	// Persistence side effects
	assert.Len(t, companyRepo.companies, 1)
	assert.Len(t, competitorRepo.created, len(fakes.FakeCompetitorNames))
	assert.Len(t, dossierRepo.created, 1)
}

func TestStrategyAgentRun_ProgressEventsEmitted(t *testing.T) {
	agent := newAgentWithFakes(&stubCompanyRepo{}, &stubCompetitorRepo{}, &stubDossierRepo{})

	progress := make(chan services.ProgressEvent, 64)
	_, err := agent.Run("", "analyze another company", progress, nil)
	require.NoError(t, err)
	close(progress)

	var steps []string
	for e := range progress {
		if e.Type == "step" {
			steps = append(steps, e.Step)
		}
	}
	assert.NotEmpty(t, steps, "pipeline should emit progress steps")
}

func TestIdentifyCompany_WithFakes(t *testing.T) {
	agent := newAgentWithFakes(&stubCompanyRepo{}, &stubCompetitorRepo{}, &stubDossierRepo{})

	result, err := agent.IdentifyCompany("who competes with example.com?", nil)
	require.NoError(t, err)
	assert.Equal(t, "Fake Target Inc", result.CompanyName)
	assert.Contains(t, result.ProfileURL, "linkedin.com/company/")
}

func TestNormalizeThreat(t *testing.T) {
	cases := map[string]string{
		"low":      "LOW",
		"HIGH":     "HIGH",
		"Critical": "CRITICAL",
		"bogus":    "MODERATE",
		"":         "MODERATE",
	}
	for in, want := range cases {
		assert.Equal(t, want, services.NormalizeThreat(in), "input %q", in)
	}
}
