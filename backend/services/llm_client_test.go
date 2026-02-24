package services

import (
	"bytes"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockRoundTripper is a mock implementation of http.RoundTripper.
type MockRoundTripper struct {
	mock.Mock
}

func (m *MockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	args := m.Called(req)
	return args.Get(0).(*http.Response), args.Error(1)
}

func TestSummarizeChatTitle(t *testing.T) {
	apiKey := "test-api-key"

	t.Run("successful summarization", func(t *testing.T) {
		mockTransport := new(MockRoundTripper)
		client := &LLMClient{
			apiKey: apiKey,
			model:  "gemini-2.0-flash",
			httpClient: &http.Client{
				Transport: mockTransport,
			},
		}

		history := []ConversationTurn{
			{Role: "user", Content: "Tell me about Google."},
			{Role: "assistant", Content: "Google is a tech company."},
		}
		expectedTitle := "Google Tech Company Overview"

		geminiResponseJSON := `{
			"candidates": [
				{
					"content": {
						"parts": [
							{"text": "` + expectedTitle + `"}
						]
					}
				}
			]
		}`
		mockResp := &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(geminiResponseJSON)),
			Header:     make(http.Header),
		}

		mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(mockResp, nil).Once()

		title, err := client.SummarizeChatTitle(history)
		assert.NoError(t, err)
		assert.Equal(t, expectedTitle, title)
		mockTransport.AssertExpectations(t)
	})

	t.Run("LLM API error", func(t *testing.T) {
		mockTransport := new(MockRoundTripper)
		client := &LLMClient{
			apiKey: apiKey,
			model:  "gemini-2.0-flash",
			httpClient: &http.Client{
				Transport: mockTransport,
			},
		}

		history := []ConversationTurn{
			{Role: "user", Content: "Error test."},
		}

		mockResp := &http.Response{
			StatusCode: http.StatusInternalServerError,
			Body:       io.NopCloser(bytes.NewBufferString(`{"error": "internal server error"}`)),
			Header:     make(http.Header),
		}

		mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(mockResp, nil).Once()

		_, err := client.SummarizeChatTitle(history)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "gemini API returned status 500")
		mockTransport.AssertExpectations(t)
	})

	t.Run("empty LLM response", func(t *testing.T) {
		mockTransport := new(MockRoundTripper)
		client := &LLMClient{
			apiKey: apiKey,
			model:  "gemini-2.0-flash",
			httpClient: &http.Client{
				Transport: mockTransport,
			},
		}

		history := []ConversationTurn{
			{Role: "user", Content: "Empty response test."},
		}

		geminiResponseJSON := `{
			"candidates": []
		}`
		mockResp := &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(geminiResponseJSON)),
			Header:     make(http.Header),
		}

		mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(mockResp, nil).Once()

		_, err := client.SummarizeChatTitle(history)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "empty gemini response")
		mockTransport.AssertExpectations(t)
	})

	t.Run("invalid JSON LLM response", func(t *testing.T) {
		mockTransport := new(MockRoundTripper)
		client := &LLMClient{
			apiKey: apiKey,
			model:  "gemini-2.0-flash",
			httpClient: &http.Client{
				Transport: mockTransport,
			},
		}

		history := []ConversationTurn{
			{Role: "user", Content: "Invalid JSON test."},
		}

		geminiResponseJSON := `invalid json`
		mockResp := &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(geminiResponseJSON)),
			Header:     make(http.Header),
		}

		mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(mockResp, nil).Once()

		_, err := client.SummarizeChatTitle(history)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "decoding gemini response")
		mockTransport.AssertExpectations(t)
	})
}
