package api

import (
	"fmt"
	"net/http"
	"sort"
	"sync"

	"golang.org/x/sync/errgroup"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rpupo63/report-backend/database"
	"github.com/rpupo63/report-backend/errs"
	"github.com/rpupo63/report-backend/models"
	"github.com/rpupo63/report-backend/services"
	"github.com/rs/zerolog/log"
)

type competitorHandler struct {
	competitorRepo database.CompetitorRepoInterface
	serpClient     *services.SerpClient
	enrichClient   *services.EnrichClient
	llmClient      services.LLMClientInterface
}

func newCompetitorHandler(competitorRepo database.CompetitorRepoInterface, serpClient *services.SerpClient, enrichClient *services.EnrichClient, llmClient services.LLMClientInterface) competitorHandler {
	return competitorHandler{
		competitorRepo: competitorRepo,
		serpClient:     serpClient,
		enrichClient:   enrichClient,
		llmClient:      llmClient,
	}
}

type CompetitorDrilldownDetails struct {
	MarketShare    string   `json:"marketShare"`
	KeyProducts    []string `json:"keyProducts"`
	Challenges     []string `json:"challenges"`
	Recommendation string   `json:"recommendation"`
}

type CompetitorDrilldownResponse struct {
	Reasoning     []ReasoningStep            `json:"reasoning"`
	FinalAnalysis string                     `json:"finalAnalysis"`
	IntelLevel    int                        `json:"intelLevel"`
	TokensUsed    int                        `json:"tokensUsed"`
	Details       CompetitorDrilldownDetails `json:"details"`
}

func (h competitorHandler) getDrilldown() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "competitorID")
		id, err := uuid.Parse(idStr)
		if err != nil {
			WriteError(log.Logger, w, errs.BadRequest("invalid competitor ID"))
			return
		}

		competitor, err := h.competitorRepo.FindByID(id)
		if err != nil {
			WriteError(log.Logger, w, err)
			return
		}
		if competitor == nil {
			WriteError(log.Logger, w, errs.NewNotFound("competitor"))
			return
		}

		if !competitor.SerpFetched {
			// 1. Re-fetch enrich data (needed for synthesis context)
			enrichData := (*services.EnrichCompanyData)(nil)
			profileURL := competitor.Website

			if profileURL == "" || !isLinkedInURL(profileURL) {
				log.Info().Str("competitorName", competitor.Name).Msg("Competitor website is not a LinkedIn URL or is empty. Attempting to find via SERP.")
				linkedInURL, err := h.serpClient.FindLinkedInURL(competitor.Name)
				if err != nil {
					log.Warn().Err(err).Str("competitorName", competitor.Name).Msg("failed to find LinkedIn URL via SERP, proceeding with original website")
					// Fallback to original website, it might still work or fail gracefully later
				} else {
					profileURL = linkedInURL
					log.Info().Str("competitorName", competitor.Name).Str("linkedInURL", profileURL).Msg("Found LinkedIn URL via SERP.")
				}
			}

			if profileURL != "" {
				enrichData, err = h.enrichClient.GetCompany(profileURL)
				if err != nil {
					log.Error().Err(err).Str("competitorName", competitor.Name).Msg("failed to re-fetch enrich data for competitor")
					// Non-fatal, proceed with existing enrich data if available or empty.
				}
			} else {
				log.Warn().Str("competitorName", competitor.Name).Msg("competitor has no website and no LinkedIn URL found, skipping enrich data re-fetch")
			}

			// 2. Run 3 SERP queries concurrently
			queries := []string{
				competitor.Name + " news 2025",
				competitor.Name + " pricing reviews",
				competitor.Name + " alternative",
			}
			var snippets []string
			var snippetMu sync.Mutex
			var serpEg errgroup.Group

			for _, q := range queries {
				q := q
				serpEg.Go(func() error {
					result, err := h.serpClient.Search(q)
					if err != nil {
						log.Warn().Err(err).Str("query", q).Msg("SERP search failed")
						return nil // non-fatal
					}
					snippetMu.Lock()
					defer snippetMu.Unlock()
					for _, r := range result.OrganicResults {
						if r.Snippet != "" {
							snippets = append(snippets, r.Snippet)
						}
					}
					return nil
				})
			}
			serpEg.Wait() //nolint:errcheck — all errors are swallowed above

			// 3. Re-synthesize with LLM (enrich + SERP snippets)
			synthesis, _, err := h.llmClient.SynthesizeCompetitor(competitor.Name, enrichData, snippets)
			if err != nil {
				WriteError(log.Logger, w, err)
				return
			}

			// 4. Update DB: core fields + serp_fetched=true
			err = h.competitorRepo.UpdateSerpData(
				competitor.ID,
				synthesis.ValueProposition,
				synthesis.MarketShare,
				synthesis.RecentMovements+" "+synthesis.CustomerSentiment,
				synthesis.Recommendation,
				synthesis.IntelLevel,
				services.NormalizeThreat(synthesis.ThreatLevel),
				true, // serpFetched
			)
			if err != nil {
				WriteError(log.Logger, w, err)
				return
			}

			// 5. Replace key products and challenges:
			//    - DeleteKeyProductsByCompetitorID + re-add from new synthesis
			//    - DeleteChallengesByCompetitorID + re-add from new synthesis
			err = h.competitorRepo.DeleteKeyProductsByCompetitorID(competitor.ID)
			if err != nil {
				log.Error().Err(err).Str("competitorID", competitor.ID.String()).Msg("failed to delete old key products")
			}
			for _, kp := range synthesis.KeyProducts {
				_ = h.competitorRepo.AddKeyProduct(models.CompetitorKeyProduct{
					CompetitorID: competitor.ID,
					Value:        kp,
				})
			}

			err = h.competitorRepo.DeleteChallengesByCompetitorID(competitor.ID)
			if err != nil {
				log.Error().Err(err).Str("competitorID", competitor.ID.String()).Msg("failed to delete old challenges")
			}
			for _, challenge := range synthesis.KnownChallenges {
				_ = h.competitorRepo.AddChallenge(models.CompetitorChallenge{
					CompetitorID: competitor.ID,
					Value:        challenge,
				})
			}

			// 6. Add "Web Reconnaissance" reasoning entry
			err = h.competitorRepo.AddReasoning(models.CompetitorReasoning{
				CompetitorID: competitor.ID,
				Step:         "Web Reconnaissance",
				Summary:      fmt.Sprintf("Ran 3 SERP queries on demand. Collected %d snippets.", len(snippets)),
				Status:       "complete",
				SortOrder:    20, // Assuming this is after initial enrich and synthesis
			})
			if err != nil {
				log.Error().Err(err).Str("competitorID", competitor.ID.String()).Msg("failed to add web reconnaissance reasoning")
			}

			// 7. Reload competitor from DB to get fresh data
			competitor, err = h.competitorRepo.FindByID(id)
			if err != nil {
				WriteError(log.Logger, w, err)
				return
			}
			if competitor == nil {
				WriteError(log.Logger, w, errs.NewNotFound("competitor after reload"))
				return
			}
		}

		// Sort reasonings by SortOrder
		sort.Slice(competitor.Reasonings, func(i, j int) bool {
			return competitor.Reasonings[i].SortOrder < competitor.Reasonings[j].SortOrder
		})

		reasoning := make([]ReasoningStep, 0, len(competitor.Reasonings))
		for _, rn := range competitor.Reasonings {
			reasoning = append(reasoning, ReasoningStep{
				Step:    rn.Step,
				Summary: rn.Summary,
				Status:  rn.Status,
			})
		}

		keyProducts := make([]string, 0, len(competitor.KeyProducts))
		for _, kp := range competitor.KeyProducts {
			keyProducts = append(keyProducts, kp.Value)
		}

		challenges := make([]string, 0, len(competitor.Challenges))
		for _, c := range competitor.Challenges {
			challenges = append(challenges, c.Value)
		}

		resp := CompetitorDrilldownResponse{
			Reasoning:     reasoning,
			FinalAnalysis: competitor.FinalAnalysis,
			IntelLevel:    competitor.IntelLevel,
			TokensUsed:    512,
			Details: CompetitorDrilldownDetails{
				MarketShare:    competitor.MarketShare,
				KeyProducts:    keyProducts,
				Challenges:     challenges,
				Recommendation: competitor.Recommendation,
			},
		}

		WriteJSON(log.Logger, w, resp)
	}
}

// isLinkedInURL checks if a URL is a valid LinkedIn company profile URL.
func isLinkedInURL(u string) bool {
	return u != "" && (
	// Standard LinkedIn company page
	(len(u) >= 29 && u[0:29] == "https://www.linkedin.com/company/") ||
		// LinkedIn company page with locale
		(len(u) >= 32 && u[0:32] == "https://www.linkedin.com/in/company/") ||
		// Shorter vanity URL for company page (less common but possible)
		(len(u) >= 26 && u[0:26] == "https://linkedin.com/company/") ||
		// Shorter vanity URL for company page with locale
		(len(u) >= 29 && u[0:29] == "https://linkedin.com/in/company/"))
}
