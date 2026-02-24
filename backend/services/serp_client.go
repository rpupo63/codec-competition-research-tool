package services

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/serpapi/serpapi-golang"
)

// SerpClient calls a web search endpoint.
type SerpClient struct {
	apiKey    string
	llmClient LLMClientInterface
}

// SerpResult is the top-level web search response.
type SerpResult struct {
	OrganicResults []SerpOrganicResult `json:"organic_results"`
}

// SerpOrganicResult represents a single search result entry.
type SerpOrganicResult struct {
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
	Link    string `json:"link"`
}

func NewSerpClient(apiKey string, llmClient LLMClientInterface) *SerpClient {
	return &SerpClient{
		apiKey:    apiKey,
		llmClient: llmClient,
	}
}

// Search executes a Google search via the web reconnaissance service and returns organic results.
func (c *SerpClient) Search(query string) (*SerpResult, error) {
	log.Printf("DEBUG SerpClient.Search: Incoming query: %s", query)

	formattedQuery := query

	setting := serpapi.NewSerpApiClientSetting(c.apiKey)
	setting.Engine = "google"
	client := serpapi.NewClient(setting)

	parameter := map[string]string{
		"q":             formattedQuery,
		"google_domain": "google.com",
		"hl":            "en",
		"gl":            "us",
		"num":           "5",
	}

	results, err := client.Search(parameter)
	if err != nil {
		log.Printf("ERROR SerpClient.Search: Executing serp request for query '%s' failed: %v", formattedQuery, err)
		return nil, fmt.Errorf("executing serp request: %w", err)
	}

	resultBytes, err := json.Marshal(results)
	if err != nil {
		log.Printf("ERROR SerpClient.Search: Marshaling serp results for query '%s' failed: %v", formattedQuery, err)
		return nil, fmt.Errorf("marshaling serp results: %w", err)
	}
	log.Printf("DEBUG SerpClient.Search: Raw SERP results for query '%s': %s", formattedQuery, string(resultBytes))

	var parsedResult SerpResult
	if err := json.Unmarshal(resultBytes, &parsedResult); err != nil {
		log.Printf("ERROR SerpClient.Search: Decoding serp response into struct for query '%s' failed: %v", formattedQuery, err)
		return nil, fmt.Errorf("decoding serp response into struct: %w", err)
	}
	log.Printf("DEBUG SerpClient.Search: Parsed SERP results for query '%s' found %d organic results.", formattedQuery, len(parsedResult.OrganicResults))

	return &parsedResult, nil
}

// FindLinkedInURL searches for a company's LinkedIn profile URL using SERP.
func (c *SerpClient) FindLinkedInURL(companyName string) (string, error) {
	query := fmt.Sprintf("%s LinkedIn", companyName)
	log.Printf("DEBUG SerpClient.FindLinkedInURL: Searching for LinkedIn profile for company: '%s' with query: '%s'", companyName, query)

	searchResult, err := c.Search(query)
	if err != nil {
		log.Printf("ERROR SerpClient.FindLinkedInURL: Serp search for LinkedIn URL for '%s' failed: %v", companyName, err)
		return "", fmt.Errorf("serp search for LinkedIn URL failed: %w", err)
	}

	for _, result := range searchResult.OrganicResults {
		isLinkedIn := IsLinkedInURL(result.Link)
		log.Printf("DEBUG SerpClient.FindLinkedInURL: Checking link: %s, Is LinkedIn: %t", result.Link, isLinkedIn)
		if isLinkedIn {
			log.Printf("DEBUG SerpClient.FindLinkedInURL: Found LinkedIn profile: %s for company: %s", result.Link, companyName)
			return result.Link, nil
		}
	}

	log.Printf("DEBUG SerpClient.FindLinkedInURL: No LinkedIn company profile found for %s", companyName)
	return "", fmt.Errorf("no LinkedIn company profile found for %s", companyName)
}

// IsLinkedInURL checks if a URL is a valid LinkedIn company profile URL.
// Moved from strategy_agent.go and made public for broader use.
func IsLinkedInURL(u string) bool {
	return u != "" && strings.Contains(u, "linkedin.com") && strings.Contains(u, "/company/")
}
