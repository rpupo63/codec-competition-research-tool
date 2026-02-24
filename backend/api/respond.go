package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/rpupo63/report-backend/errs"
	"github.com/rs/zerolog"
)

func WriteJSON(logger zerolog.Logger, w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	// Marshal the data first to check size and handle errors
	jsonData, err := json.Marshal(data)
	if err != nil {
		logger.Error().Err(err).Msg("error marshaling response data")
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	// Check if response is too large (e.g., > 10MB)
	const maxResponseSize = 10 * 1024 * 1024 // 10MB
	if len(jsonData) > maxResponseSize {
		logger.Error().
			Int("responseSize", len(jsonData)).
			Int("maxSize", maxResponseSize).
			Msg("response too large, truncating")

		// Return a truncated response with error info
		truncatedResponse := map[string]interface{}{
			"error":        "Response too large",
			"message":      "The requested data exceeds the maximum response size",
			"maxSizeMB":    maxResponseSize / (1024 * 1024),
			"actualSizeMB": len(jsonData) / (1024 * 1024),
		}

		truncatedJSON, err := json.Marshal(truncatedResponse)
		if err != nil {
			logger.Error().Err(err).Msg("error marshaling truncated response")
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusRequestEntityTooLarge)
		w.Write(truncatedJSON)
		return
	}

	// Write the response
	if _, err := w.Write(jsonData); err != nil {
		logger.Error().Err(err).Msg("error writing response")
	}
}

func SendErrorNotification(logger zerolog.Logger, errMsg string) {
	// Create the request body
	reqBody := map[string]string{
		"errorMessage": errMsg,
	}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		logger.Error().Err(err).Msg("Error marshaling error notification request")
		return
	}

	// Send POST request to Python service
	resp, err := http.Post("https://python.pronexus.ai/send_error_notification", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		logger.Error().Err(err).Msg("Error sending error notification")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logger.Error().Msgf("Error notification service returned non-200 status: %d", resp.StatusCode)
	}
}

func WriteError(logger zerolog.Logger, w http.ResponseWriter, err error) {
	var apiErr *errs.ApiErr

	// For unexpected errors, log and return generic internal error
	if !errors.As(err, &apiErr) {
		logger.Error().Msg(err.Error())
		// Send error notification for unexpected errors
		SendErrorNotification(logger, err.Error())
		// Set status and write JSON without re-calling WriteHeader inside writeJSON
		w.WriteHeader(http.StatusInternalServerError)
		WriteJSON(logger, w, map[string]interface{}{
			"error":   "Internal Server Error",
			"message": "An unexpected error occurred",
			"details": err.Error(), // Include actual error in development
			"status":  "error",
		})
		return
	}

	// Build response based on error details
	response := map[string]interface{}{
		"error":  apiErr.Error(),
		"status": "error",
	}

	// Add field information if present (for validation errors)
	if apiErr.Field != "" {
		response["field"] = apiErr.Field
	}

	// Add details if present
	if apiErr.Details != "" {
		response["details"] = apiErr.Details
	}

	// Add full error chain for debugging (especially useful for database errors)
	if apiErr.Cause != nil {
		response["cause"] = apiErr.GetFullError()
	}

	// For expected errors, set the status code from apiErr
	w.WriteHeader(apiErr.StatusCode)
	WriteJSON(logger, w, response)
}

// WriteTimeoutError writes a standardized timeout error response
func WriteTimeoutError(logger zerolog.Logger, w http.ResponseWriter, timeout time.Duration, endpoint string) {
	w.WriteHeader(http.StatusRequestTimeout)
	WriteJSON(logger, w, map[string]interface{}{
		"error":           "Request timeout",
		"message":         "The request took too long to process",
		"timeout_seconds": int(timeout.Seconds()),
		"status":          "timeout",
		"endpoint":        endpoint,
	})
}

// WriteValidationError writes a standardized validation error response
func WriteValidationError(logger zerolog.Logger, w http.ResponseWriter, field string, message string) {
	w.WriteHeader(http.StatusBadRequest)
	WriteJSON(logger, w, map[string]interface{}{
		"error":   "Validation error",
		"message": message,
		"field":   field,
		"status":  "validation_error",
	})
}

// WithTimeoutCheck wraps a handler function to check for context timeout
func WithTimeoutCheck(logger zerolog.Logger, handler func(http.ResponseWriter, *http.Request)) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		// Check if context is already cancelled
		select {
		case <-req.Context().Done():
			WriteTimeoutError(logger, w, 30*time.Second, req.URL.Path)
			return
		default:
			// Continue with handler
		}

		handler(w, req)
	}
}

// CheckContextTimeout checks if the request context has timed out
func CheckContextTimeout(logger zerolog.Logger, w http.ResponseWriter, req *http.Request) bool {
	select {
	case <-req.Context().Done():
		WriteTimeoutError(logger, w, 30*time.Second, req.URL.Path)
		return true
	default:
		return false
	}
}

// wrapDatabaseError wraps a database error with context information
func wrapDatabaseError(operation, entity string, cause error) error {
	return errs.NewDatabaseError(operation, entity, cause)
}
