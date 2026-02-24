package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type LLMClientInterface interface {
	SummarizeChatTitle(history []ConversationTurn) (string, error)
	ClassifyIntent(history []ConversationTurn, newMessage string) string
	GenerateConversationalResponse(history []ConversationTurn, newMessage string) (string, int, error)
	ExtractCompanyName(message string, history []ConversationTurn) (string, int, error)
	ExtractFocusAreas(userPrompt string) ([]string, int, error)
	SynthesizeCompetitor(companyName string, enrichData *EnrichCompanyData, serpSnippets []string) (*CompetitorSynthesis, int, error)
	NameOperation(targetCompany string, focusAreas []string, syntheses map[string]*CompetitorSynthesis) (string, int, error)
	GenerateBattlePlan(targetCompany string, focusAreas []string, syntheses map[string]*CompetitorSynthesis) (*BattlePlan, int, error)
	ValidateBattlePlan(plan *BattlePlan, targetCompany string, syntheses map[string]*CompetitorSynthesis) (*BattlePlan, int, error)
	DiscoverCompetitors(companyName string) ([]EnrichSimilarCompany, int, error)
	DiscoverMoreCompetitors(companyName string, exclude []EnrichSimilarCompany, needed int) ([]EnrichSimilarCompany, int, error)
	FormatGoogleSearchQuery(rawQuery string) (string, int, error)
}

// LLMClient calls the Gemini Flash generative AI API.
type LLMClient struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

// --- Gemini REST wire types ---

type geminiRequest struct {
	Contents         []geminiContent  `json:"contents"`
	GenerationConfig *geminiGenConfig `json:"generationConfig,omitempty"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
	Role  string       `json:"role,omitempty"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiGenConfig struct {
	ResponseMimeType string  `json:"responseMimeType,omitempty"`
	Temperature      float64 `json:"temperature,omitempty"`
}

type geminiResponse struct {
	Candidates    []geminiCandidate   `json:"candidates"`
	UsageMetadata geminiUsageMetadata `json:"usageMetadata"`
}

type geminiUsageMetadata struct {
	TotalTokenCount int `json:"totalTokenCount"`
}

type geminiCandidate struct {
	Content geminiContent `json:"content"`
}

// ConversationTurn represents a single message in a multi-turn conversation.
type ConversationTurn struct {
	Role    string `json:"role"` // "user" or "assistant"
	Content string `json:"content"`
}

// --- Structured output types used across pipeline steps ---

// FocusAreaResponse is the Step 0 LLM output.
type FocusAreaResponse struct {
	FocusAreas []string `json:"focus_areas"`
}

// CompanyNameResponse is used to extract a company identifier from a free-form message.
type CompanyNameResponse struct {
	Company string `json:"company"`
}

// intentResponse is the JSON schema returned by ClassifyIntent.
type intentResponse struct {
	Intent string `json:"intent"`
}

// OperationNameResponse is the JSON schema returned by NameOperation.
type OperationNameResponse struct {
	OperationName string `json:"operation_name"`
}

// CompetitorSynthesis is the Step 4 LLM output per competitor.
// Fields map directly to models.Competitor and its child tables.
type CompetitorSynthesis struct {
	ValueProposition  string   `json:"value_proposition"`
	KnownChallenges   []string `json:"known_challenges"`
	RecentMovements   string   `json:"recent_movements"`
	CustomerSentiment string   `json:"customer_sentiment"`
	ThreatLevel       string   `json:"threat_level"` // LOW|MODERATE|HIGH|CRITICAL
	MarketShare       string   `json:"market_share"` // e.g. "12%" or "~$2B ARR"
	KeyProducts       []string `json:"key_products"`
	Recommendation    string   `json:"recommendation"` // specific action against this competitor
	IntelLevel        int      `json:"intel_level"`    // 1-100
	AICapability      string   `json:"ai_capability"`  // LOW|MODERATE|HIGH|CRITICAL
	KeyStrength       string   `json:"key_strength"`
}

// BattlePlan is the Step 5 LLM output — the final strategic dossier.
// Maps to models.IntelDossier, DossierMatrixEntry, DossierChallenge, DossierStrategicRecommendation.
type BattlePlan struct {
	OperationName string                `json:"operation_name"`
	FinalAnalysis string                `json:"final_analysis"`
	Matrix        []BattlePlanMatrix    `json:"matrix"`
	Challenges    []BattlePlanChallenge `json:"challenges"`
	StrikePlan    []BattlePlanStrike    `json:"strike_plan"`
}

type BattlePlanMatrix struct {
	Name           string `json:"name"`
	ThreatLevel    string `json:"threat_level"` // LOW|MODERATE|HIGH|CRITICAL
	MarketShare    string `json:"market_share"`
	KeyStrength    string `json:"key_strength"`
	PrimaryProduct string `json:"primary_product"`
	AICapability   string `json:"ai_capability"` // LOW|MODERATE|HIGH|CRITICAL
}

type BattlePlanChallenge struct {
	Competitor string   `json:"competitor"`
	Gaps       []string `json:"gaps"`
}

type BattlePlanStrike struct {
	Codename  string `json:"codename"`
	Objective string `json:"objective"`
	Target    string `json:"target"`
	Approach  string `json:"approach"`
	Timeline  string `json:"timeline"`
	Priority  string `json:"priority"` // ALPHA|BRAVO|CHARLIE
}

// discoverCompetitorsResponse is the JSON schema returned by DiscoverCompetitors.
type discoverCompetitorsResponse struct {
	Competitors []EnrichSimilarCompany `json:"competitors"`
}

// DiscoverCompetitors asks the LLM to identify real direct competitors of a given company.
// Returns up to 5 competitors as EnrichSimilarCompany entries.
func (c *LLMClient) DiscoverCompetitors(companyName string) ([]EnrichSimilarCompany, int, error) {
	text, tokens, err := c.complete(PromptDiscoverCompetitors, fmt.Sprintf("Company: %s", companyName), true)
	if err != nil {
		return nil, 0, fmt.Errorf("discovering competitors for %s: %w", companyName, err)
	}

	var result discoverCompetitorsResponse
	if err := json.Unmarshal([]byte(text), &result); err != nil {
		return nil, tokens, fmt.Errorf("parsing competitor discovery for %s: %w", companyName, err)
	}

	return result.Competitors, tokens, nil
}

// DiscoverMoreCompetitors asks the LLM to identify additional direct competitors, excluding a provided list.
func (c *LLMClient) DiscoverMoreCompetitors(companyName string, exclude []EnrichSimilarCompany, needed int) ([]EnrichSimilarCompany, int, error) {
	excludeNames := make([]string, len(exclude))
	for i, comp := range exclude {
		excludeNames[i] = comp.Name
	}
	excludeList := strings.Join(excludeNames, ", ")

	prompt := fmt.Sprintf(PromptDiscoverMoreCompetitorsTemplate, needed, companyName, excludeList)

	text, tokens, err := c.complete(prompt, "", true)
	if err != nil {
		return nil, 0, fmt.Errorf("discovering more competitors for %s: %w", companyName, err)
	}

	var result discoverCompetitorsResponse
	if err := json.Unmarshal([]byte(text), &result); err != nil {
		return nil, tokens, fmt.Errorf("parsing more competitor discovery for %s: %w", companyName, err)
	}

	return result.Competitors, tokens, nil
}

func (c *LLMClient) SummarizeChatTitle(history []ConversationTurn) (string, error) {
	title, _, err := c.completeWithHistory(PromptSummarizeChatTitle, history, "", false)
	if err != nil {
		return "", fmt.Errorf("summarizing chat title: %w", err)
	}

	return strings.TrimSpace(title), nil
}

func NewLLMClient(apiKey string) *LLMClient {
	return &LLMClient{
		apiKey: apiKey,
		model:  "gemini-2.0-flash",
		httpClient: &http.Client{
			Timeout: 90 * time.Second,
		},
	}
}

// complete sends a prompt to Gemini and returns the raw text response and token count.
// When jsonMode is true it requests JSON MIME type output.
func (c *LLMClient) complete(systemPrompt, userContent string, jsonMode bool) (string, int, error) {
	fullPrompt := systemPrompt + "\n\n" + userContent

	reqBody := geminiRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{{Text: fullPrompt}},
				Role:  "user",
			},
		},
	}

	if jsonMode {
		reqBody.GenerationConfig = &geminiGenConfig{
			ResponseMimeType: "application/json",
			Temperature:      0.3,
		}
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", 0, fmt.Errorf("marshaling gemini request: %w", err)
	}

	apiURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		c.model, c.apiKey,
	)

	resp, err := c.httpClient.Post(apiURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return "", 0, fmt.Errorf("calling gemini API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", 0, fmt.Errorf("gemini API returned status %d", resp.StatusCode)
	}

	var gemResp geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&gemResp); err != nil {
		return "", 0, fmt.Errorf("decoding gemini response: %w", err)
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		return "", 0, fmt.Errorf("empty gemini response")
	}

	return gemResp.Candidates[0].Content.Parts[0].Text, gemResp.UsageMetadata.TotalTokenCount, nil
}

// completeWithHistory sends a multi-turn conversation to Gemini and returns the raw text response and token count.
// history contains prior turns; userContent is the new user message.
// The system prompt is prepended to the first user turn.
func (c *LLMClient) completeWithHistory(systemPrompt string, history []ConversationTurn, userContent string, jsonMode bool) (string, int, error) {
	var contents []geminiContent

	for i, turn := range history {
		role := turn.Role
		if role == "assistant" {
			role = "model"
		}
		text := turn.Content
		// Prepend system prompt to the very first user turn
		if i == 0 && role == "user" && systemPrompt != "" {
			text = systemPrompt + "\n\n" + text
		}
		contents = append(contents, geminiContent{
			Parts: []geminiPart{{Text: text}},
			Role:  role,
		})
	}

	// Append the new user message, including system prompt if no history
	newMsg := userContent
	if len(history) == 0 && systemPrompt != "" {
		newMsg = systemPrompt + "\n\n" + userContent
	}
	contents = append(contents, geminiContent{
		Parts: []geminiPart{{Text: newMsg}},
		Role:  "user",
	})

	reqBody := geminiRequest{Contents: contents}
	if jsonMode {
		reqBody.GenerationConfig = &geminiGenConfig{
			ResponseMimeType: "application/json",
			Temperature:      0.3,
		}
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", 0, fmt.Errorf("marshaling gemini request: %w", err)
	}

	apiURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		c.model, c.apiKey,
	)

	resp, err := c.httpClient.Post(apiURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return "", 0, fmt.Errorf("calling gemini API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", 0, fmt.Errorf("gemini API returned status %d", resp.StatusCode)
	}

	var gemResp geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&gemResp); err != nil {
		return "", 0, fmt.Errorf("decoding gemini response: %w", err)
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		return "", 0, fmt.Errorf("empty gemini response")
	}

	return gemResp.Candidates[0].Content.Parts[0].Text, gemResp.UsageMetadata.TotalTokenCount, nil
}

// ClassifyIntent determines whether the new message is a follow-up, new query, or general question.
// Returns "new_query", "followup", or "general".
func (c *LLMClient) ClassifyIntent(history []ConversationTurn, newMessage string) string {
	text, _, err := c.completeWithHistory(PromptClassifyIntent, history, newMessage, true)
	if err != nil {
		return "new_query" // safe default
	}

	var result intentResponse
	if err := json.Unmarshal([]byte(text), &result); err != nil {
		return "new_query"
	}

	switch result.Intent {
	case "followup", "general", "new_query":
		return result.Intent
	default:
		return "new_query"
	}
}

// GenerateConversationalResponse generates a Colonel-style conversational reply
// for follow-up and general questions, using conversation history for context.
func (c *LLMClient) GenerateConversationalResponse(history []ConversationTurn, newMessage string) (string, int, error) {
	return c.completeWithHistory(PromptGenerateConversationalResponse, history, newMessage, false)
}

// ExtractCompanyName extracts a clean company name or domain from a free-form message.
// history is used to resolve ambiguous references like "them" or "that company".
// Used in Step 0 before querying the company data enrichment service.
func (c *LLMClient) ExtractCompanyName(message string, history []ConversationTurn) (string, int, error) {
	text, tokens, err := c.completeWithHistory(PromptExtractCompanyName, history, message, true)
	if err != nil {
		return "", 0, err
	}

	var result CompanyNameResponse
	if err := json.Unmarshal([]byte(text), &result); err != nil || result.Company == "" {
		// Fall back to first word of message
		return strings.Fields(message)[0], tokens, nil
	}

	return result.Company, tokens, nil
}

// ExtractFocusAreas identifies which strategic pillars to emphasise.
// Returns a default set if the prompt is generic.
func (c *LLMClient) ExtractFocusAreas(userPrompt string) ([]string, int, error) {
	text, tokens, err := c.complete(PromptExtractFocusAreas, userPrompt, true)
	if err != nil {
		return defaultFocusAreas(), 0, nil
	}

	var result FocusAreaResponse
	if err := json.Unmarshal([]byte(text), &result); err != nil || len(result.FocusAreas) == 0 {
		return defaultFocusAreas(), tokens, nil
	}

	return result.FocusAreas, tokens, nil
}

func defaultFocusAreas() []string {
	return []string{"pricing", "product_features", "sales_funnel", "marketing", "customer_success"}
}

// SynthesizeCompetitor runs Step 4 for a single competitor.
// It combines company data enrichment structural data with web reconnaissance snippets into a structured assessment.
func (c *LLMClient) SynthesizeCompetitor(companyName string, enrichData *EnrichCompanyData, serpSnippets []string) (*CompetitorSynthesis, int, error) {
	// Structure the raw data for the LLM.
	inputData := map[string]interface{}{
		"company_name":  companyName,
		"enrich_data":   enrichData,
		"serp_snippets": serpSnippets,
	}
	rawBytes, err := json.Marshal(inputData)
	if err != nil {
		return nil, 0, fmt.Errorf("marshaling input data for competitor synthesis: %w", err)
	}
	rawData := string(rawBytes)

	text, tokens, err := c.complete(PromptSynthesizeCompetitor, rawData, true)
	if err != nil {
		return nil, 0, fmt.Errorf("synthesizing competitor %s: %w", companyName, err)
	}

	var synthesis CompetitorSynthesis
	if err := json.Unmarshal([]byte(text), &synthesis); err != nil {
		return nil, tokens, fmt.Errorf("parsing synthesis for %s: %w", companyName, err)
	}

	return &synthesis, tokens, nil
}

const PromptNameOperation = `You are a creative strategist naming a top-secret business operation. Based on the provided intelligence, devise a memorable, clever, and thematic codename.

Your response MUST be a JSON object with a single key "operation_name".

The name should be 2-4 words. Examples: "Operation Nightfall", "Project Chimera", "Thunderclap Initiative".

Do not include any other commentary or explanation. Just the JSON.
`

// NameOperation devises a thematic codename for the operation.
func (c *LLMClient) NameOperation(targetCompany string, focusAreas []string, syntheses map[string]*CompetitorSynthesis) (string, int, error) {
	competitorNames := make([]string, 0, len(syntheses))
	for name := range syntheses {
		competitorNames = append(competitorNames, name)
	}

	input := fmt.Sprintf(
		"Target Company: %s\nFocus Areas: %s\nKnown Competitors: %s",
		targetCompany,
		strings.Join(focusAreas, ", "),
		strings.Join(competitorNames, ", "),
	)

	text, tokens, err := c.complete(PromptNameOperation, input, true)
	if err != nil {
		return "", 0, fmt.Errorf("naming operation: %w", err)
	}

	var result OperationNameResponse
	if err := json.Unmarshal([]byte(text), &result); err != nil || result.OperationName == "" {
		return "", tokens, fmt.Errorf("parsing operation name response: %w", err)
	}

	return result.OperationName, tokens, nil
}

// GenerateBattlePlan runs Step 5 — the final strategic orchestration call.
// It consumes all competitor syntheses and the target company's focus areas to produce a battle plan.
func (c *LLMClient) GenerateBattlePlan(targetCompany string, focusAreas []string, syntheses map[string]*CompetitorSynthesis) (*BattlePlan, int, error) {
	system := fmt.Sprintf(PromptGenerateBattlePlanTemplate, strings.Join(focusAreas, ", "))

	input := fmt.Sprintf("Target Company: %s\n\nCompetitor Intelligence:\n", targetCompany)
	for name, s := range syntheses {
		synthJSON, _ := json.Marshal(s)
		input += fmt.Sprintf("\n%s:\n%s\n", name, string(synthJSON))
	}

	text, tokens, err := c.complete(system, input, true)
	if err != nil {
		return nil, 0, fmt.Errorf("generating battle plan: %w", err)
	}

	var plan BattlePlan
	if err := json.Unmarshal([]byte(text), &plan); err != nil {
		return nil, tokens, fmt.Errorf("parsing battle plan: %w", err)
	}

	return &plan, tokens, nil
}

// ValidateBattlePlan performs Step 5's validation loop.
// A secondary LLM call checks whether advice is generic and rewrites if needed.
// Falls back to the original plan on any failure.
func (c *LLMClient) ValidateBattlePlan(plan *BattlePlan, targetCompany string, syntheses map[string]*CompetitorSynthesis) (*BattlePlan, int, error) {
	planJSON, err := json.Marshal(plan)
	if err != nil {
		return plan, 0, nil // non-fatal, proceed with original plan
	}

	synthJSON, err := json.Marshal(syntheses)
	if err != nil {
		return plan, 0, nil // non-fatal, proceed with original plan
	}

	input := fmt.Sprintf("Target: %s\n\nBattle Plan:\n%s\n\nSource Data:\n%s", targetCompany, string(planJSON), string(synthJSON))

	text, tokens, err := c.complete(PromptValidateBattlePlan, input, true)
	if err != nil {
		return plan, 0, nil // non-fatal: return original
	}

	var validated BattlePlan
	if err := json.Unmarshal([]byte(text), &validated); err != nil {
		return plan, tokens, nil // non-fatal: return original
	}

	return &validated, tokens, nil
}

// FormatGoogleSearchQuery refines a raw query into a high-quality Google search query.
func (c *LLMClient) FormatGoogleSearchQuery(rawQuery string) (string, int, error) {
	text, tokens, err := c.complete(PromptFormatGoogleSearch, rawQuery, false)
	if err != nil {
		return "", 0, fmt.Errorf("formatting google search query: %w", err)
	}

	return strings.TrimSpace(text), tokens, nil
}
