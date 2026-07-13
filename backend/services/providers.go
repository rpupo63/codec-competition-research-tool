package services

// SerpProvider abstracts web search so tests and CI can substitute a fake
// (the SerpAPI SDK has no endpoint override).
type SerpProvider interface {
	Search(query string) (*SerpResult, error)
	FindLinkedInURL(companyName string) (string, error)
}

// EnrichProvider abstracts the EnrichLayer company-data API.
type EnrichProvider interface {
	GetCompany(profileURL string) (*EnrichCompanyData, error)
}

var (
	_ SerpProvider   = (*SerpClient)(nil)
	_ EnrichProvider = (*EnrichClient)(nil)
)
