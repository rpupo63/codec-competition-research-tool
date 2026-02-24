package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// EnrichClient calls the EnrichLayer API v2.
type EnrichClient struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// EnrichCompanyData is the sanitized, flattened response used by your application.
type EnrichCompanyData struct {
	Name             string                 `json:"name"`
	Website          string                 `json:"website"` // Renamed from Domain to match API semantics
	Description      string                 `json:"description"`
	Headcount        string                 `json:"headcount"` // Formatted string from company_size range
	Location         string                 `json:"location"`
	Industry         string                 `json:"industry"`
	SimilarCompanies []EnrichSimilarCompany `json:"similar_companies"`
}

// EnrichSimilarCompany represents a competitor entry.
type EnrichSimilarCompany struct {
	Name     string `json:"name"`
	Link     string `json:"link"`
	Location string `json:"location"`
	// Note: API v2 does not return a similarity score, so Score was removed.
}

// Internal structs to match the specific JSON shape of the EnrichLayer API v2 response
type apiResponse struct {
	Name             string           `json:"name"`
	Website          string           `json:"website"`
	Description      string           `json:"description"`
	Industry         string           `json:"industry"`
	CompanySize      []*int           `json:"company_size"` // API returns [min, max] where max can be null
	HQ               apiLocation      `json:"hq"`
	SimilarCompanies []apiSimilarComp `json:"similar_companies"`
}

type apiLocation struct {
	City    string `json:"city"`
	State   string `json:"state"`
	Country string `json:"country"`
}

type apiSimilarComp struct {
	Name     string `json:"name"`
	Link     string `json:"link"`
	Location string `json:"location"`
}

func NewEnrichClient(apiKey string) *EnrichClient {
	return &EnrichClient{
		apiKey:  apiKey,
		baseURL: "https://enrichlayer.com/api/v2",
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetCompany fetches company data using the EnrichLayer v2 API.
// profileURL must be a valid company profile URL (e.g., "https://www.linkedin.com/company/google/").
func (c *EnrichClient) GetCompany(profileURL string) (*EnrichCompanyData, error) {
	// 1. Prepare Query Parameters
	params := url.Values{}
	params.Set("url", profileURL)
	params.Set("use_cache", "if-present")       // Save credits/time if available
	params.Set("fallback_to_cache", "on-error") // Robustness

	// Construct URL
	reqURL := fmt.Sprintf("%s/company?%s", c.baseURL, params.Encode())

	// 2. Build Request
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("building enrich request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	// 3. Execute Request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing enrich request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// You might want to parse the body here for specific API error messages
		return nil, fmt.Errorf("enrich API returned status %d", resp.StatusCode)
	}

	// 4. Decode Raw Response
	var rawData apiResponse
	if err := json.NewDecoder(resp.Body).Decode(&rawData); err != nil {
		return nil, fmt.Errorf("decoding enrich response: %w", err)
	}

	// 5. Map Raw Data to Application Domain Struct
	result := &EnrichCompanyData{
		Name:        rawData.Name,
		Website:     rawData.Website,
		Description: rawData.Description,
		Industry:    rawData.Industry,
		Location:    fmt.Sprintf("%s, %s", rawData.HQ.City, rawData.HQ.State),
		Headcount:   formatHeadcount(rawData.CompanySize),
	}

	// Map Similar Companies
	for _, sim := range rawData.SimilarCompanies {
		result.SimilarCompanies = append(result.SimilarCompanies, EnrichSimilarCompany{
			Name:     sim.Name,
			Link:     sim.Link,
			Location: sim.Location,
		})
	}

	return result, nil
}

// formatHeadcount converts the [min, max] array into a readable string.
func formatHeadcount(size []*int) string {
	if len(size) == 0 {
		return "Unknown"
	}

	min := 0
	if size[0] != nil {
		min = *size[0]
	}

	// Handle case where max is null (e.g., [10001, null] -> "10001+")
	if len(size) > 1 && size[1] == nil {
		return fmt.Sprintf("%d+", min)
	}

	// Handle case where max exists (e.g., [500, 1000] -> "500-1000")
	if len(size) > 1 && size[1] != nil {
		return fmt.Sprintf("%d-%d", min, *size[1])
	}

	return fmt.Sprintf("%d", min)
}
