package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rpupo63/report-backend/models"
	"github.com/rpupo63/report-backend/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"
)

// MockChatMessageRepo is a mock implementation of database.ChatMessageRepo.
type MockChatMessageRepo struct {
	mock.Mock
}

func (m *MockChatMessageRepo) FindBySessionID(sessionID uuid.UUID) ([]models.ChatMessage, error) {
	args := m.Called(sessionID)
	return args.Get(0).([]models.ChatMessage), args.Error(1)
}

func (m *MockChatMessageRepo) FindMainBySessionID(sessionID uuid.UUID) ([]models.ChatMessage, error) {
	args := m.Called(sessionID)
	return args.Get(0).([]models.ChatMessage), args.Error(1)
}

func (m *MockChatMessageRepo) NextSortOrder(sessionID uuid.UUID) (int, error) {
	args := m.Called(sessionID)
	return args.Int(0), args.Error(1)
}

func (m *MockChatMessageRepo) Add(msg models.ChatMessage) (*models.ChatMessage, error) {
	args := m.Called(msg)
	return args.Get(0).(*models.ChatMessage), args.Error(1)
}

// MockChatSessionRepo is a mock implementation of database.ChatSessionRepo.
type MockChatSessionRepo struct {
	mock.Mock
}

func (m *MockChatSessionRepo) FindAll() ([]models.ChatSession, error) {
	args := m.Called()
	return args.Get(0).([]models.ChatSession), args.Error(1)
}

func (m *MockChatSessionRepo) Create(session models.ChatSession) (*models.ChatSession, error) {
	args := m.Called(session)
	return args.Get(0).(*models.ChatSession), args.Error(1)
}

func (m *MockChatSessionRepo) FindByID(sessionID uuid.UUID) (*models.ChatSession, error) {
	args := m.Called(sessionID)
	return args.Get(0).(*models.ChatSession), args.Error(1)
}

func (m *MockChatSessionRepo) UpdateTitle(sessionID uuid.UUID, title string) error {
	args := m.Called(sessionID, title)
	return args.Error(0)
}

func (m *MockChatSessionRepo) Delete(sessionID uuid.UUID) error {
	args := m.Called(sessionID)
	return args.Error(0)
}

// MockLLMClient is a mock implementation of services.LLMClient.
type MockLLMClient struct {
	mock.Mock
}

func (m *MockLLMClient) SummarizeChatTitle(history []services.ConversationTurn) (string, error) {
	args := m.Called(history)
	return args.String(0), args.Error(1)
}

func (m *MockLLMClient) ClassifyIntent(history []services.ConversationTurn, newMessage string) string {
	args := m.Called(history, newMessage)
	return args.String(0)
}

func (m *MockLLMClient) GenerateConversationalResponse(history []services.ConversationTurn, newMessage string) (string, error) {
	args := m.Called(history, newMessage)
	return args.String(0), args.Error(1)
}

func (m *MockLLMClient) ExtractCompanyName(message string, history []services.ConversationTurn) (string, int, error) {
	args := m.Called(message, history)
	return args.String(0), args.Int(1), args.Error(2)
}

func (m *MockLLMClient) ExtractFocusAreas(userPrompt string) ([]string, error) {
	args := m.Called(userPrompt)
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockLLMClient) SynthesizeCompetitor(companyName string, enrichData *services.EnrichCompanyData, serpSnippets []string) (*services.CompetitorSynthesis, error) {
	args := m.Called(companyName, enrichData, serpSnippets)
	return args.Get(0).(*services.CompetitorSynthesis), args.Error(1)
}

func (m *MockLLMClient) GenerateBattlePlan(targetCompany string, focusAreas []string, syntheses map[string]*services.CompetitorSynthesis) (*services.BattlePlan, error) {
	args := m.Called(targetCompany, focusAreas, syntheses)
	return args.Get(0).(*services.BattlePlan), args.Error(1)
}

func (m *MockLLMClient) ValidateBattlePlan(plan *services.BattlePlan, targetCompany string, syntheses map[string]*services.CompetitorSynthesis) (*services.BattlePlan, error) {
	args := m.Called(plan, targetCompany, syntheses)
	return args.Get(0).(*services.BattlePlan), args.Error(1)
}

func (m *MockLLMClient) DiscoverCompetitors(companyName string) ([]services.EnrichSimilarCompany, int, error) {
	args := m.Called(companyName)
	return args.Get(0).([]services.EnrichSimilarCompany), args.Int(1), args.Error(2)
}

func TestSummarizeSessionTitle(t *testing.T) {
	sessionID := uuid.New()

	mockMessageRepo := new(MockChatMessageRepo)
	mockSessionRepo := new(MockChatSessionRepo)
	mockLLMClient := new(MockLLMClient)

	h := newSessionHandler(
		mockSessionRepo,
		mockMessageRepo,
		nil, // competitorRepo not needed for this test
		nil, // dossierRepo not needed for this test
		nil, // sessionCompetitorRepo not needed for this test
		mockLLMClient,
	)

	router := chi.NewRouter()
	router.Post("/sessions/{sessionID}/summarize", h.summarizeSessionTitle)

	t.Run("successful summarization", func(t *testing.T) {
		messages := []models.ChatMessage{
			{SessionID: sessionID, Sender: "SNAKE", Text: "Hello Colonel"},
			{SessionID: sessionID, Sender: "COLONEL", Text: "Snake, do you read me?"},
		}
		expectedHistory := []services.ConversationTurn{
			{Role: "user", Content: "Hello Colonel"},
			{Role: "assistant", Content: "Snake, do you read me?"},
		}
		expectedTitle := "Initial greeting conversation"

		mockMessageRepo.On("FindMainBySessionID", sessionID).Return(messages, nil).Once()
		mockLLMClient.On("SummarizeChatTitle", expectedHistory).Return(expectedTitle, nil).Once()
		mockSessionRepo.On("UpdateTitle", sessionID, expectedTitle).Return(nil).Once()

		req, _ := http.NewRequest("POST", "/sessions/"+sessionID.String()+"/summarize", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		var responseBody map[string]string
		err := json.Unmarshal(rr.Body.Bytes(), &responseBody)
		assert.NoError(t, err)
		assert.Equal(t, expectedTitle, responseBody["title"])

		mockMessageRepo.AssertExpectations(t)
		mockLLMClient.AssertExpectations(t)
		mockSessionRepo.AssertExpectations(t)
	})

	t.Run("invalid session ID", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/sessions/invalid-uuid/summarize", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
		var errorResponse map[string]string
		err := json.Unmarshal(rr.Body.Bytes(), &errorResponse)
		assert.NoError(t, err)
		assert.Contains(t, errorResponse["error"], "Invalid session ID")
	})

	t.Run("no messages in session", func(t *testing.T) {
		mockMessageRepo.On("FindMainBySessionID", sessionID).Return([]models.ChatMessage{}, nil).Once()

		req, _ := http.NewRequest("POST", "/sessions/"+sessionID.String()+"/summarize", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNoContent, rr.Code)
		var responseBody map[string]string
		err := json.Unmarshal(rr.Body.Bytes(), &responseBody)
		assert.NoError(t, err)
		assert.Equal(t, "", responseBody["title"])

		mockMessageRepo.AssertExpectations(t)
	})

	t.Run("no conversational messages in session", func(t *testing.T) {
		messages := []models.ChatMessage{
			{SessionID: sessionID, Sender: "SYSTEM", Text: "System message"},
		}

		mockMessageRepo.On("FindMainBySessionID", sessionID).Return(messages, nil).Once()

		req, _ := http.NewRequest("POST", "/sessions/"+sessionID.String()+"/summarize", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNoContent, rr.Code)
		var responseBody map[string]string
		err := json.Unmarshal(rr.Body.Bytes(), &responseBody)
		assert.NoError(t, err)
		assert.Equal(t, "", responseBody["title"])

		mockMessageRepo.AssertExpectations(t)
	})

	t.Run("LLM client error", func(t *testing.T) {
		messages := []models.ChatMessage{
			{SessionID: sessionID, Sender: "SNAKE", Text: "Hello Colonel"},
		}
		expectedHistory := []services.ConversationTurn{
			{Role: "user", Content: "Hello Colonel"},
		}

		mockMessageRepo.On("FindMainBySessionID", sessionID).Return(messages, nil).Once()
		mockLLMClient.On("SummarizeChatTitle", expectedHistory).Return("", errors.New("LLM API error")).Once()

		req, _ := http.NewRequest("POST", "/sessions/"+sessionID.String()+"/summarize", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		var errorResponse map[string]string
		err := json.Unmarshal(rr.Body.Bytes(), &errorResponse)
		assert.NoError(t, err)
		assert.Contains(t, errorResponse["error"], "Failed to generate title")

		mockMessageRepo.AssertExpectations(t)
		mockLLMClient.AssertExpectations(t)
	})

	t.Run("database update error", func(t *testing.T) {
		messages := []models.ChatMessage{
			{SessionID: sessionID, Sender: "SNAKE", Text: "Hello Colonel"},
		}
		expectedHistory := []services.ConversationTurn{
			{Role: "user", Content: "Hello Colonel"},
		}
		expectedTitle := "Initial greeting"

		mockMessageRepo.On("FindMainBySessionID", sessionID).Return(messages, nil).Once()
		mockLLMClient.On("SummarizeChatTitle", expectedHistory).Return(expectedTitle, nil).Once()
		mockSessionRepo.On("UpdateTitle", sessionID, expectedTitle).Return(errors.New("DB error")).Once()

		req, _ := http.NewRequest("POST", "/sessions/"+sessionID.String()+"/summarize", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		var errorResponse map[string]string
		err := json.Unmarshal(rr.Body.Bytes(), &errorResponse)
		assert.NoError(t, err)
		assert.Contains(t, errorResponse["error"], "Failed to update session title in DB")

		mockMessageRepo.AssertExpectations(t)
		mockLLMClient.AssertExpectations(t)
		mockSessionRepo.AssertExpectations(t)
	})

	t.Run("database record not found on update", func(t *testing.T) {
		messages := []models.ChatMessage{
			{SessionID: sessionID, Sender: "SNAKE", Text: "Hello Colonel"},
		}
		expectedHistory := []services.ConversationTurn{
			{Role: "user", Content: "Hello Colonel"},
		}
		expectedTitle := "Initial greeting"

		mockMessageRepo.On("FindMainBySessionID", sessionID).Return(messages, nil).Once()
		mockLLMClient.On("SummarizeChatTitle", expectedHistory).Return(expectedTitle, nil).Once()
		mockSessionRepo.On("UpdateTitle", sessionID, expectedTitle).Return(gorm.ErrRecordNotFound).Once()

		req, _ := http.NewRequest("POST", "/sessions/"+sessionID.String()+"/summarize", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
		var errorResponse map[string]string
		err := json.Unmarshal(rr.Body.Bytes(), &errorResponse)
		assert.NoError(t, err)
		assert.Contains(t, errorResponse["error"], "Session not found for title update")

		mockMessageRepo.AssertExpectations(t)
		mockLLMClient.AssertExpectations(t)
		mockSessionRepo.AssertExpectations(t)
	})
}

// This is a dummy interface to make testing possible.
type llmClientMock interface {
	SummarizeChatTitle(history []services.ConversationTurn) (string, error)
}
