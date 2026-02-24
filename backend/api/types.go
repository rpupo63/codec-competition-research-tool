package api

// routeHandlers contains all the handlers for different route types
type routeHandlers struct {
	chatHandler       chatHandler
	competitorHandler competitorHandler
	sessionHandler    sessionHandler
}

// ErrorResponse represents an error response from the API
type ErrorResponse struct {
	Error   string `json:"error"`
	Status  string `json:"status"`
	Field   string `json:"field,omitempty"`
	Details string `json:"details,omitempty"`
	Cause   string `json:"cause,omitempty"`
}
