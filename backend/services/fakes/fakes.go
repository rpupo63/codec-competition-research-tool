// Package fakes provides deterministic, offline implementations of the
// external-provider interfaces (LLM, SERP, EnrichLayer) so the full analysis
// pipeline can run in tests and CI without API keys or network access.
// Enabled in production builds via FAKE_PROVIDERS=true (see main.go).
package fakes

import (
	"fmt"

	"github.com/rpupo63/report-backend/services"
)

// FakeCompetitorNames are the competitors every analysis discovers.
var FakeCompetitorNames = []string{"Globex Corporation", "Initech Systems", "Umbrella Dynamics"}

// ── SerpProvider ───────────────────────────────────────────────────────────────

type FakeSerp struct{}

func NewFakeSerp() *FakeSerp { return &FakeSerp{} }

func (f *FakeSerp) Search(query string) (*services.SerpResult, error) {
	return &services.SerpResult{
		OrganicResults: []services.SerpOrganicResult{
			{
				Title:   "Result for " + query,
				Snippet: fmt.Sprintf("Deterministic snippet about %q for offline testing.", query),
				Link:    "https://www.linkedin.com/company/fake-target/",
			},
			{
				Title:   "Industry overview",
				Snippet: "Market growing 12% YoY; incumbents face pricing pressure.",
				Link:    "https://example.com/industry-report",
			},
		},
	}, nil
}

func (f *FakeSerp) FindLinkedInURL(companyName string) (string, error) {
	return fmt.Sprintf("https://www.linkedin.com/company/%s/", slug(companyName)), nil
}

// ── EnrichProvider ─────────────────────────────────────────────────────────────

type FakeEnrich struct{}

func NewFakeEnrich() *FakeEnrich { return &FakeEnrich{} }

func (f *FakeEnrich) GetCompany(profileURL string) (*services.EnrichCompanyData, error) {
	similar := make([]services.EnrichSimilarCompany, 0, len(FakeCompetitorNames))
	for _, name := range FakeCompetitorNames {
		similar = append(similar, services.EnrichSimilarCompany{
			Name:     name,
			Link:     fmt.Sprintf("https://www.linkedin.com/company/%s/", slug(name)),
			Location: "Austin, TX",
		})
	}
	return &services.EnrichCompanyData{
		Name:             "Fake Target Inc",
		Website:          "https://faketarget.example.com",
		Description:      "Deterministic company profile served by the fake enrich provider.",
		Headcount:        "201-500",
		Location:         "Austin, TX",
		Industry:         "Software Development",
		SimilarCompanies: similar,
	}, nil
}

// ── LLMClientInterface ─────────────────────────────────────────────────────────

type FakeLLM struct{}

func NewFakeLLM() *FakeLLM { return &FakeLLM{} }

func (f *FakeLLM) SummarizeChatTitle(history []services.ConversationTurn) (string, error) {
	return "Operation Fake Summary", nil
}

func (f *FakeLLM) ClassifyIntent(history []services.ConversationTurn, newMessage string) string {
	// Always treat messages as a new analysis so E2E exercises the full pipeline.
	return "new_query"
}

func (f *FakeLLM) GenerateConversationalResponse(history []services.ConversationTurn, newMessage string) (string, int, error) {
	return "Acknowledged, Analyst. Deterministic conversational reply for testing.", 7, nil
}

func (f *FakeLLM) ExtractCompanyName(message string, history []services.ConversationTurn) (string, int, error) {
	return "Fake Target Inc", 5, nil
}

func (f *FakeLLM) ExtractFocusAreas(userPrompt string) ([]string, int, error) {
	return []string{"pricing", "product", "market share"}, 5, nil
}

func (f *FakeLLM) SynthesizeCompetitor(companyName string, enrichData *services.EnrichCompanyData, serpSnippets []string) (*services.CompetitorSynthesis, int, error) {
	return &services.CompetitorSynthesis{
		ValueProposition:  fmt.Sprintf("%s offers a competing platform with strong enterprise adoption.", companyName),
		KnownChallenges:   []string{"Legacy architecture", "Slow release cadence"},
		RecentMovements:   "Announced a strategic partnership last quarter.",
		CustomerSentiment: "Mostly positive with complaints about pricing.",
		ThreatLevel:       "HIGH",
		MarketShare:       "12%",
		KeyProducts:       []string{companyName + " Core", companyName + " Analytics"},
		Recommendation:    fmt.Sprintf("Undercut %s on pricing and ship faster.", companyName),
		IntelLevel:        87,
		AICapability:      "MODERATE",
		KeyStrength:       "Enterprise distribution",
	}, 42, nil
}

func (f *FakeLLM) NameOperation(targetCompany string, focusAreas []string, syntheses map[string]*services.CompetitorSynthesis) (string, int, error) {
	return "OPERATION PAPER TIGER", 5, nil
}

func (f *FakeLLM) GenerateBattlePlan(targetCompany string, focusAreas []string, syntheses map[string]*services.CompetitorSynthesis) (*services.BattlePlan, int, error) {
	plan := &services.BattlePlan{
		OperationName: "OPERATION PAPER TIGER",
		FinalAnalysis: fmt.Sprintf("Analyst, the landscape around %s is contested but winnable. Deterministic battle plan for testing.", targetCompany),
	}
	for name, s := range syntheses {
		plan.Matrix = append(plan.Matrix, services.BattlePlanMatrix{
			Name:           name,
			ThreatLevel:    s.ThreatLevel,
			MarketShare:    s.MarketShare,
			KeyStrength:    s.KeyStrength,
			PrimaryProduct: name + " Core",
			AICapability:   s.AICapability,
		})
		plan.Challenges = append(plan.Challenges, services.BattlePlanChallenge{
			Competitor: name,
			Gaps:       s.KnownChallenges,
		})
	}
	plan.StrikePlan = []services.BattlePlanStrike{
		{
			Codename:  "SILENT LEDGER",
			Objective: "Win on transparent pricing",
			Target:    "Mid-market accounts",
			Approach:  "Publish comparison pages and migration tooling",
			Timeline:  "Q1",
			Priority:  "ALPHA",
		},
	}
	return plan, 64, nil
}

func (f *FakeLLM) ValidateBattlePlan(plan *services.BattlePlan, targetCompany string, syntheses map[string]*services.CompetitorSynthesis) (*services.BattlePlan, int, error) {
	return plan, 3, nil
}

func (f *FakeLLM) DiscoverCompetitors(companyName string) ([]services.EnrichSimilarCompany, int, error) {
	out := make([]services.EnrichSimilarCompany, 0, len(FakeCompetitorNames))
	for _, name := range FakeCompetitorNames {
		out = append(out, services.EnrichSimilarCompany{
			Name: name,
			Link: fmt.Sprintf("https://www.linkedin.com/company/%s/", slug(name)),
		})
	}
	return out, 11, nil
}

func (f *FakeLLM) DiscoverMoreCompetitors(companyName string, exclude []services.EnrichSimilarCompany, needed int) ([]services.EnrichSimilarCompany, int, error) {
	return nil, 0, nil
}

func (f *FakeLLM) FormatGoogleSearchQuery(rawQuery string) (string, int, error) {
	return rawQuery, 1, nil
}

var (
	_ services.SerpProvider       = (*FakeSerp)(nil)
	_ services.EnrichProvider     = (*FakeEnrich)(nil)
	_ services.LLMClientInterface = (*FakeLLM)(nil)
)

func slug(s string) string {
	out := make([]rune, 0, len(s))
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z' || r >= '0' && r <= '9':
			out = append(out, r)
		case r >= 'A' && r <= 'Z':
			out = append(out, r+('a'-'A'))
		case r == ' ' || r == '-':
			out = append(out, '-')
		}
	}
	return string(out)
}
