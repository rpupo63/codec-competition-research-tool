package services

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/rpupo63/report-backend/database"
	"github.com/rpupo63/report-backend/models"
)

const maxCompetitors = 5

// ProgressEvent is emitted on the progress channel as the pipeline advances.
type ProgressEvent struct {
	Type    string      `json:"type"` // "step", "done", or "error"
	Step    string      `json:"step,omitempty"`
	Summary string      `json:"summary,omitempty"`
	Status  string      `json:"status,omitempty"`  // "pending" or "complete"
	Payload interface{} `json:"payload,omitempty"` // Add this field
}

// emit sends a ProgressEvent without blocking if the channel is full or nil.
func emit(ch chan<- ProgressEvent, e ProgressEvent) {
	if ch == nil {
		return
	}
	select {
	case ch <- e:
	default:
	}
}

// StrategyContext carries pipeline state from step to step.
type StrategyContext struct {
	TargetCompany string
	FocusAreas    []string
	Competitors   []enrichedCompetitor
}

// enrichedCompetitor bundles all gathered data for one competitor before synthesis.
type enrichedCompetitor struct {
	Name        string
	Link        string
	EnrichData  *EnrichCompanyData
	SerpResults []string
	Synthesis   *CompetitorSynthesis
}

// AgentResult is the final output returned to the handler after DB persistence.
type AgentResult struct {
	Company       *models.Company
	Competitors   []models.Competitor
	Dossier       *models.IntelDossier
	FinalAnalysis string
	IntelLevel    int
	TokensUsed    int
}

// IdentifyResult holds the outcome of the identification step.
type IdentifyResult struct {
	UserInput   string
	CompanyName string
	ProfileURL  string
}

// AnalysisParams holds the confirmed inputs for the analysis step.
type AnalysisParams struct {
	UserInput   string
	CompanyName string
	ProfileURL  string
	History     []ConversationTurn
}

// StrategyAgent orchestrates the full 5-step competitive analysis pipeline.
type StrategyAgent struct {
	enrichClient   *EnrichClient
	serpClient     *SerpClient
	llmClient      LLMClientInterface
	companyRepo    database.CompanyRepoInterface
	competitorRepo database.CompetitorRepoInterface
	dossierRepo    database.IntelDossierRepoInterface
}

// NewStrategyAgent reads API keys from environment and wires up all clients.
func NewStrategyAgent(
	companyRepo database.CompanyRepoInterface,
	competitorRepo database.CompetitorRepoInterface,
	dossierRepo database.IntelDossierRepoInterface,
	llmClient LLMClientInterface,
) *StrategyAgent {
	return &StrategyAgent{
		enrichClient:   NewEnrichClient(os.Getenv("ENRICH_API_KEY")),
		serpClient:     NewSerpClient(os.Getenv("SERP_API_KEY"), llmClient),
		llmClient:      llmClient,
		companyRepo:    companyRepo,
		competitorRepo: competitorRepo,
		dossierRepo:    dossierRepo,
	}
}

// IdentifyCompany performs the initial step of resolving a user input to a specific company and profile URL.
func (a *StrategyAgent) IdentifyCompany(userInput string, history []ConversationTurn) (*IdentifyResult, error) {
	companyIdentifier := userInput
	var profileURL string
	if IsLinkedInURL(companyIdentifier) {
		profileURL = companyIdentifier
		// Extract company name from path for other uses
		u, _ := url.Parse(profileURL)
		pathParts := strings.Split(strings.Trim(u.Path, "/"), "/")
		if len(pathParts) >= 2 && pathParts[0] == "company" {
			companyIdentifier = pathParts[1]
		}
	} else if isURL(companyIdentifier) { // It's some other URL
		companyNameFromURL := extractCompanyFromURL(companyIdentifier)
		if companyNameFromURL != "" {
			companyIdentifier = companyNameFromURL
		}
	}

	// If we still don't have a clean identifier (or it was just a prompt), use LLM
	if companyIdentifier == "" || companyIdentifier == userInput {
		extracted, _, err := a.llmClient.ExtractCompanyName(userInput, history)
		if err == nil && extracted != "" {
			companyIdentifier = extracted
		}
	}

	// Now, if we DON'T have a profileURL yet, find it.
	if profileURL == "" {
		searchQuery := fmt.Sprintf("%s linkedin company profile", companyIdentifier)
		serpResult, err := a.serpClient.Search(searchQuery)
		if err == nil && serpResult != nil {
			for _, r := range serpResult.OrganicResults {
				if IsLinkedInURL(r.Link) {
					profileURL = r.Link
					break
				}
			}
		}
	}

	// If a profileURL is still not found after all attempts, return an error.
	if profileURL == "" {
		return nil, fmt.Errorf("could not identify a LinkedIn company profile for '%s'", userInput)
	}

	// Get the canonical name from the enrichment service if possible
	// This step is non-fatal; if enrich fails, we still have companyIdentifier from earlier steps.
	if profileURL != "" {
		enrichData, err := a.enrichClient.GetCompany(profileURL)
		if err == nil && enrichData != nil && enrichData.Name != "" {
			companyIdentifier = enrichData.Name
		}
	}

	return &IdentifyResult{
		UserInput:   userInput,
		CompanyName: companyIdentifier,
		ProfileURL:  profileURL,
	}, nil
}

// Run executes the full pipeline and persists all results to the database.
//
//   - companyIdentifier: the company name or domain to research (extracted from user message if empty)
//   - userPrompt:        the user's raw message, used to extract focus areas
//   - progress:          optional channel for incremental ProgressEvents; pass nil to disable
//   - history:           prior conversation turns for context-aware extraction
func (a *StrategyAgent) Run(companyIdentifier, userPrompt string, progress chan<- ProgressEvent, history []ConversationTurn) (*AgentResult, error) {
	var totalTokens int64
	var profileURL string

	// ── Step 0: Intent extraction ──────────────────────────────────────────────

	emit(progress, ProgressEvent{Type: "step", Step: "Parsing strategic intent...", Summary: "Extracting company identifier and focus areas from request.", Status: "pending"})

	if IsLinkedInURL(companyIdentifier) {
		profileURL = companyIdentifier
		// Extract company name from path for other uses
		u, _ := url.Parse(profileURL)
		pathParts := strings.Split(strings.Trim(u.Path, "/"), "/")
		if len(pathParts) >= 2 && pathParts[0] == "company" {
			companyIdentifier = pathParts[1]
		}
	} else if isURL(companyIdentifier) { // It's some other URL
		companyNameFromURL := extractCompanyFromURL(companyIdentifier)
		if companyNameFromURL != "" {
			companyIdentifier = companyNameFromURL
		}
	}

	// If we still don't have a clean identifier (or it was just a prompt), use LLM
	if companyIdentifier == "" || companyIdentifier == userPrompt {
		extracted, tokens, err := a.llmClient.ExtractCompanyName(userPrompt, history)
		if err == nil && extracted != "" {
			companyIdentifier = extracted
		}
		atomic.AddInt64(&totalTokens, int64(tokens))
	}

	// Now, if we DON'T have a profileURL yet, find it.
	if profileURL == "" {
		emit(progress, ProgressEvent{Type: "step", Step: "Locating company profile...", Summary: fmt.Sprintf("Searching for %s's LinkedIn profile.", companyIdentifier), Status: "pending"})
		searchQuery := fmt.Sprintf("%s linkedin company profile", companyIdentifier)
		serpResult, err := a.serpClient.Search(searchQuery)
		if err == nil && serpResult != nil {
			for _, r := range serpResult.OrganicResults {
				if IsLinkedInURL(r.Link) {
					profileURL = r.Link
					break
				}
			}
		}
		if profileURL != "" {
			emit(progress, ProgressEvent{Type: "step", Step: "Locating company profile...", Summary: "Found LinkedIn profile.", Status: "complete"})
		} else {
			emit(progress, ProgressEvent{Type: "step", Step: "Locating company profile...", Summary: "Could not locate a LinkedIn profile, enrichment may be limited.", Status: "complete"})
		}
	}

	targetData, err := a.enrichClient.GetCompany(profileURL) // Always use profileURL for enrichment
	if err != nil {
		// Non-fatal: continue without enrichment data for the target
		targetData = &EnrichCompanyData{Name: companyIdentifier}
	}
	companyName := companyIdentifier
	if targetData != nil && targetData.Name != "" {
		companyName = targetData.Name
	}

	// NEW: Emit resolved company name
	emit(progress, ProgressEvent{
		Type:    "company_resolved", // New event type
		Payload: map[string]string{"resolvedName": companyName},
	})

	focusAreas, tokens, err := a.llmClient.ExtractFocusAreas(userPrompt)
	if err != nil {
		focusAreas = defaultFocusAreas()
	}
	atomic.AddInt64(&totalTokens, int64(tokens))

	emit(progress, ProgressEvent{Type: "step", Step: "Parsing strategic intent...", Summary: fmt.Sprintf("Identified target: %s. Focus areas: %s.", companyName, strings.Join(focusAreas, ", ")), Status: "complete"})

	ctx := &StrategyContext{
		TargetCompany: companyName,
		FocusAreas:    focusAreas,
	}

	// ── Step 1: Competitor discovery via company data service ───────────────────────────

	emit(progress, ProgressEvent{Type: "step", Step: "Gathering company intelligence...", Summary: "Discovering similar companies and gathering structural data via company data enrichment.", Status: "pending"})

	similar := targetData.SimilarCompanies

	// If the company data service returned generic placeholder competitors, ask the LLM for real ones.
	genericNames := map[string]bool{
		"Acme Corp": true, "TechRival": true, "CompeteX": true,
		"MarketLeader Inc": true, "NexGen Solutions": true,
	}
	isGeneric := len(similar) > 0
	for _, s := range similar {
		if !genericNames[s.Name] {
			isGeneric = false
			break
		}
	}
	if len(similar) == 0 || isGeneric {
		discovered, tokens, err := a.llmClient.DiscoverCompetitors(companyName)
		if err == nil && len(discovered) > 0 {
			similar = discovered
		}
		atomic.AddInt64(&totalTokens, int64(tokens))
	}

	const minCompetitors = 3
	if len(similar) < minCompetitors {
		emit(progress, ProgressEvent{Type: "step", Step: "Deepening competitor search...", Summary: fmt.Sprintf("Initial scan found %d competitors, seeking at least %d.", len(similar), minCompetitors), Status: "pending"})
		needed := minCompetitors - len(similar)
		more, tokens, err := a.llmClient.DiscoverMoreCompetitors(companyName, similar, needed)
		atomic.AddInt64(&totalTokens, int64(tokens))
		if err == nil && len(more) > 0 {
			existing := make(map[string]bool)
			for _, s := range similar {
				existing[s.Name] = true
			}
			for _, m := range more {
				if !existing[m.Name] {
					similar = append(similar, m)
				}
			}
		}
		emit(progress, ProgressEvent{Type: "step", Step: "Deepening competitor search...", Summary: fmt.Sprintf("Found %d total competitors.", len(similar)), Status: "complete"})
	}

	if len(similar) > maxCompetitors {
		similar = similar[:maxCompetitors]
	}
	if len(similar) == 0 {
		return nil, fmt.Errorf("could not discover competitors for %q", companyName)
	}

	emit(progress, ProgressEvent{Type: "step", Step: "Gathering company intelligence...", Summary: fmt.Sprintf("Discovered %d competitors for %s.", len(similar), companyName), Status: "complete"})

	// ── Steps 2 & 3: Concurrent company data enrichment + web reconnaissance per competitor ───────────

	emit(progress, ProgressEvent{Type: "step", Step: "Conducting reconnaissance...", Summary: "Gathering company data and searching the web for each competitor.", Status: "pending"})

	type competitorData struct {
		details     EnrichSimilarCompany
		enrichData  *EnrichCompanyData
		serpResults []string
	}
	// Use a slice of pointers to allow modification in goroutines
	competitorResults := make([]*competitorData, len(similar))
	for i, s := range similar {
		competitorResults[i] = &competitorData{details: s}
	}

	var eg errgroup.Group
	for _, compData := range competitorResults {
		compData := compData // capture range variable

		// Step 2: Enrich
		eg.Go(func() error {
			profileURL := compData.details.Link
			if profileURL == "" || !IsLinkedInURL(profileURL) {
				linkedInURL, err := a.serpClient.FindLinkedInURL(compData.details.Name)
				if err != nil {
					// Log and proceed, enrich will likely fail or be skipped
					fmt.Printf("Could not find LinkedIn URL for competitor %s via SERP: %v\n", compData.details.Name, err)
				} else {
					profileURL = linkedInURL
				}
			}

			if profileURL != "" {
				data, _ := a.enrichClient.GetCompany(profileURL) // non-fatal
				compData.enrichData = data
			}
			return nil
		})

		// Step 3: Web Recon
		eg.Go(func() error {
			query := fmt.Sprintf("%s company overview, recent news, and reviews", compData.details.Name)
			serpResult, err := a.serpClient.Search(query) // non-fatal
			if err == nil && serpResult != nil {
				snippets := make([]string, 0, len(serpResult.OrganicResults))
				for _, r := range serpResult.OrganicResults {
					if r.Snippet != "" {
						snippets = append(snippets, r.Snippet)
					}
				}
				compData.serpResults = snippets
			}
			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return nil, fmt.Errorf("steps 2&3 data gathering: %w", err)
	}

	emit(progress, ProgressEvent{Type: "step", Step: "Conducting reconnaissance...", Summary: fmt.Sprintf("Gathered intelligence on %d competitors.", len(competitorResults)), Status: "complete"})

	// ── Step 4: Concurrent AI synthesis per competitor ─────────────────────────

	emit(progress, ProgressEvent{Type: "step", Step: "AI synthesis in progress...", Summary: "LLM synthesizing raw data into structured competitor intelligence with threat assessments.", Status: "pending"})

	syntheses := make(map[string]*CompetitorSynthesis, len(competitorResults))
	var synthMu sync.Mutex
	var synEg errgroup.Group

	for _, compData := range competitorResults {
		compData := compData // capture range variable
		synEg.Go(func() error {
			synthesis, tokens, err := a.llmClient.SynthesizeCompetitor(compData.details.Name, compData.enrichData, compData.serpResults)
			atomic.AddInt64(&totalTokens, int64(tokens))
			if err != nil {
				return nil // non-fatal: skip competitors whose synthesis fails
			}
			synthMu.Lock()
			syntheses[compData.details.Name] = synthesis
			synthMu.Unlock()
			return nil
		})
	}

	if err := synEg.Wait(); err != nil {
		return nil, fmt.Errorf("step 4 synthesis: %w", err)
	}

	if len(syntheses) == 0 {
		return nil, fmt.Errorf("all competitor syntheses failed; cannot produce a battle plan")
	}

	emit(progress, ProgressEvent{Type: "step", Step: "AI synthesis in progress...", Summary: fmt.Sprintf("Synthesized intelligence for %d competitors with competitive assessments and challenges.", len(syntheses)), Status: "complete"})

	// Populate StrategyContext
	for _, compData := range competitorResults {
		ctx.Competitors = append(ctx.Competitors, enrichedCompetitor{
			Name:        compData.details.Name,
			Link:        compData.details.Link, // Keep original link for database storage
			EnrichData:  compData.enrichData,
			SerpResults: compData.serpResults,
			Synthesis:   syntheses[compData.details.Name],
		})
	}

	// ── Step 5: Strategic battle plan + validation ─────────────────────────────

	emit(progress, ProgressEvent{Type: "step", Step: "Generating battle plan...", Summary: "Formulating final strategic recommendations and validating actionability via secondary LLM evaluation.", Status: "pending"})

	plan, tokens, err := a.llmClient.GenerateBattlePlan(companyName, focusAreas, syntheses)
	atomic.AddInt64(&totalTokens, int64(tokens))
	if err != nil {
		return nil, fmt.Errorf("step 5 battle plan: %w", err)
	}

	validatedPlan, tokens, _ := a.llmClient.ValidateBattlePlan(plan, companyName, syntheses)
	atomic.AddInt64(&totalTokens, int64(tokens))
	plan = validatedPlan // Use the validated plan

	emit(progress, ProgressEvent{Type: "step", Step: "Generating battle plan...", Summary: fmt.Sprintf("Operation %s ready. Strategic recommendations validated and actionable.", plan.OperationName), Status: "complete"})

	// ── Persist results ────────────────────────────────────────────────────────

	result, err := a.persistResults(ctx, targetData, plan)
	if err != nil {
		return nil, err
	}
	result.TokensUsed = int(totalTokens)
	return result, nil
}

// persistResults handles the storage of the analysis results into the database.
func (a *StrategyAgent) persistResults(ctx *StrategyContext, targetData *EnrichCompanyData, plan *BattlePlan) (*AgentResult, error) {
	// 1. Persist the target company
	company := models.Company{
		Name: ctx.TargetCompany,
		Slug: slugify(ctx.TargetCompany),
	}
	// Add will create or fetch an existing company by slug.
	persistedCompany, err := a.companyRepo.Add(company)
	if err != nil {
		return nil, fmt.Errorf("failed to create or retrieve company: %w", err)
	}

	// 2. Persist competitors
	persistedCompetitors := make([]models.Competitor, len(ctx.Competitors))
	for i, comp := range ctx.Competitors {
		// Default values in case Synthesis or EnrichData are nil
		threatLevel := "MODERATE"
		status := "Analyzed" // Default status
		intel := ""
		marketShare := ""
		finalAnalysis := ""
		intelLevel := 0
		recommendation := ""

		if comp.Synthesis != nil {
			threatLevel = NormalizeThreat(comp.Synthesis.ThreatLevel)
			// Combine fields for Intel
			intel = fmt.Sprintf("Value Proposition: %s. Recent Movements: %s. Customer Sentiment: %s. Key Strength: %s. AI Capability: %s.",
				comp.Synthesis.ValueProposition,
				comp.Synthesis.RecentMovements,
				comp.Synthesis.CustomerSentiment,
				comp.Synthesis.KeyStrength,
				comp.Synthesis.AICapability)
			marketShare = comp.Synthesis.MarketShare // Use MarketShare from Synthesis
			finalAnalysis = comp.Synthesis.Recommendation
			intelLevel = comp.Synthesis.IntelLevel
			recommendation = comp.Synthesis.Recommendation
		}
		// If MarketShare is not in Synthesis, try EnrichData (though EnrichCompanyData doesn't have it directly)
		// For now, it's solely from Synthesis or remains empty.

		competitor := models.Competitor{
			CompanyID:      persistedCompany.ID,
			Name:           comp.Name,
			Website:        comp.Link,
			ThreatLevel:    threatLevel,
			Status:         status,
			Intel:          intel,
			MarketShare:    marketShare,
			FinalAnalysis:  finalAnalysis,
			IntelLevel:     intelLevel,
			Recommendation: recommendation,
			SerpFetched:    len(comp.SerpResults) > 0,
		}
		if err := a.competitorRepo.CreateCompetitor(&competitor); err != nil {
			return nil, fmt.Errorf("failed to create competitor %s: %w", comp.Name, err)
		}
		persistedCompetitors[i] = competitor
	}

	// 3. Persist the intel dossier
	dossier := &models.IntelDossier{
		CompanyID:      persistedCompany.ID,
		Classification: "Strategic Analysis", // Default value
		TargetCompany:  ctx.TargetCompany,
		OperationName:  plan.OperationName,
		DateCompiled:   time.Now().Format("2006-01-02"), // Current date
	}

	// Populate Matrix
	if plan.Matrix != nil {
		dossier.Matrix = make([]models.DossierMatrixEntry, len(plan.Matrix))
		for i, entry := range plan.Matrix {
			dossier.Matrix[i] = models.DossierMatrixEntry{
				Name:           entry.Name,
				ThreatLevel:    NormalizeThreat(entry.ThreatLevel), // Use NormalizeThreat
				MarketShare:    entry.MarketShare,
				KeyStrength:    entry.KeyStrength,
				PrimaryProduct: entry.PrimaryProduct,
				AICapability:   normalizeLevel(entry.AICapability), // Use normalizeLevel for AI Capability
			}
		}
	}

	// Populate Challenges
	if plan.Challenges != nil {
		dossier.Challenges = make([]models.DossierChallenge, len(plan.Challenges))
		for i, challenge := range plan.Challenges {
			dossier.Challenges[i] = models.DossierChallenge{
				Competitor: challenge.Competitor,
			}
			if challenge.Gaps != nil {
				dossier.Challenges[i].Gaps = make([]models.DossierChallengeGap, len(challenge.Gaps))
				for j, gap := range challenge.Gaps {
					dossier.Challenges[i].Gaps[j] = models.DossierChallengeGap{
						Value: gap, // Map string gap to Value field
					}
				}
			}
		}
	}

	// Populate StrikePlan
	if plan.StrikePlan != nil {
		dossier.StrikePlan = make([]models.DossierStrikePlan, len(plan.StrikePlan))
		for i, strike := range plan.StrikePlan {
			dossier.StrikePlan[i] = models.DossierStrikePlan{
				Codename:  strike.Codename,
				Objective: strike.Objective,
				Target:    strike.Target,
				Approach:  strike.Approach,
				Timeline:  strike.Timeline,
				Priority:  normalizePriority(strike.Priority), // Use normalizePriority
			}
		}
	}

	if err := a.dossierRepo.CreateIntelDossier(dossier); err != nil {
		return nil, fmt.Errorf("failed to create intel dossier: %w", err)
	}

	return &AgentResult{
		Company:       persistedCompany,
		Competitors:   persistedCompetitors,
		Dossier:       dossier,
		FinalAnalysis: plan.FinalAnalysis,
		IntelLevel:    0, // BattlePlan does not have IntelLevel, setting to 0
	}, nil
}

// ClassifyIntent determines whether the new message is a follow-up, new query, or general question.
func (a *StrategyAgent) ClassifyIntent(history []ConversationTurn, newMessage string) string {
	return a.llmClient.ClassifyIntent(history, newMessage)
}

// GenerateConversationalResponse generates a Colonel-style conversational reply using history.
func (a *StrategyAgent) GenerateConversationalResponse(history []ConversationTurn, newMessage string) (string, int, error) {
	return a.llmClient.GenerateConversationalResponse(history, newMessage)
}

// ── helpers ────────────────────────────────────────────────────────────────────

func isURL(s string) bool {
	// A simple check to see if the string could be a URL.
	return strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") || strings.Contains(s, "www.")
}

func extractCompanyFromURL(rawURL string) string {
	// If it doesn't have a scheme, add one to help parsing.
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		rawURL = "https://" + rawURL
	}

	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return "" // Return empty if parsing fails
	}

	// Remove "www." prefix from the hostname
	host := strings.TrimPrefix(parsedURL.Hostname(), "www.")

	// Split by dot and take the first part. This is a simple heuristic.
	// e.g., "google.com" -> "google", "bbc.co.uk" -> "bbc"
	parts := strings.Split(host, ".")
	if len(parts) > 0 {
		return parts[0]
	}

	return "" // Return empty if no company name could be extracted
}

func slugify(s string) string {
	return strings.ToLower(strings.ReplaceAll(s, " ", "-"))
}

func NormalizeThreat(s string) string {
	switch strings.ToUpper(s) {
	case "LOW", "MODERATE", "HIGH", "CRITICAL":
		return strings.ToUpper(s)
	}
	return "MODERATE"
}

func normalizeLevel(s string) string {
	switch strings.ToUpper(s) {
	case "LOW", "MODERATE", "HIGH", "CRITICAL":
		return strings.ToUpper(s)
	}
	return "MODERATE"
}

func normalizePriority(s string) string {
	switch strings.ToUpper(s) {
	case "ALPHA", "BRAVO", "CHARLIE":
		return strings.ToUpper(s)
	}
	return "CHARLIE"
}
