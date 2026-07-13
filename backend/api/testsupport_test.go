package api

import (
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/rpupo63/report-backend/models"
	"gorm.io/gorm"
)

// In-memory repo implementations used to exercise handlers (and the strategy
// agent behind them) without a database.

type memCompanyRepo struct {
	mu        sync.Mutex
	companies []models.Company
}

func (m *memCompanyRepo) FindAll() ([]models.Company, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]models.Company(nil), m.companies...), nil
}

func (m *memCompanyRepo) FindByID(id uuid.UUID) (*models.Company, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.companies {
		if m.companies[i].ID == id {
			c := m.companies[i]
			return &c, nil
		}
	}
	return nil, nil
}

func (m *memCompanyRepo) FindByMessageSubstring(message string) (*models.Company, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	lower := strings.ToLower(message)
	for i := range m.companies {
		if strings.Contains(lower, strings.ToLower(m.companies[i].Name)) {
			c := m.companies[i]
			return &c, nil
		}
	}
	return nil, nil
}

func (m *memCompanyRepo) Add(company models.Company) (*models.Company, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.companies {
		if m.companies[i].Slug == company.Slug {
			c := m.companies[i]
			return &c, nil
		}
	}
	company.ID = uuid.New()
	m.companies = append(m.companies, company)
	return &company, nil
}

type memCompetitorRepo struct {
	mu          sync.Mutex
	competitors []models.Competitor
}

func (m *memCompetitorRepo) FindByCompanyID(companyID uuid.UUID) ([]models.Competitor, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []models.Competitor
	for _, c := range m.competitors {
		if c.CompanyID == companyID {
			out = append(out, c)
		}
	}
	return out, nil
}

func (m *memCompetitorRepo) FindByID(id uuid.UUID) (*models.Competitor, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.competitors {
		if m.competitors[i].ID == id {
			c := m.competitors[i]
			return &c, nil
		}
	}
	return nil, nil
}

func (m *memCompetitorRepo) CreateCompetitor(competitor *models.Competitor) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	competitor.ID = uuid.New()
	m.competitors = append(m.competitors, *competitor)
	return nil
}

func (m *memCompetitorRepo) AddKeyProduct(kp models.CompetitorKeyProduct) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.competitors {
		if m.competitors[i].ID == kp.CompetitorID {
			m.competitors[i].KeyProducts = append(m.competitors[i].KeyProducts, kp)
		}
	}
	return nil
}

func (m *memCompetitorRepo) AddChallenge(c models.CompetitorChallenge) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.competitors {
		if m.competitors[i].ID == c.CompetitorID {
			m.competitors[i].Challenges = append(m.competitors[i].Challenges, c)
		}
	}
	return nil
}

func (m *memCompetitorRepo) AddReasoning(rn models.CompetitorReasoning) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.competitors {
		if m.competitors[i].ID == rn.CompetitorID {
			m.competitors[i].Reasonings = append(m.competitors[i].Reasonings, rn)
		}
	}
	return nil
}

func (m *memCompetitorRepo) DeleteChallengesByCompetitorID(competitorID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.competitors {
		if m.competitors[i].ID == competitorID {
			m.competitors[i].Challenges = nil
		}
	}
	return nil
}

func (m *memCompetitorRepo) DeleteKeyProductsByCompetitorID(competitorID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.competitors {
		if m.competitors[i].ID == competitorID {
			m.competitors[i].KeyProducts = nil
		}
	}
	return nil
}

func (m *memCompetitorRepo) DeleteReasoningsByCompetitorID(competitorID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.competitors {
		if m.competitors[i].ID == competitorID {
			m.competitors[i].Reasonings = nil
		}
	}
	return nil
}

func (m *memCompetitorRepo) UpdateSerpData(id uuid.UUID, intel, marketShare, finalAnalysis, recommendation string, intelLevel int, threatLevel string, serpFetched bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.competitors {
		if m.competitors[i].ID == id {
			m.competitors[i].Intel = intel
			m.competitors[i].MarketShare = marketShare
			m.competitors[i].FinalAnalysis = finalAnalysis
			m.competitors[i].Recommendation = recommendation
			m.competitors[i].IntelLevel = intelLevel
			m.competitors[i].ThreatLevel = threatLevel
			m.competitors[i].SerpFetched = serpFetched
		}
	}
	return nil
}

type memDossierRepo struct {
	mu       sync.Mutex
	dossiers []models.IntelDossier
}

func (m *memDossierRepo) FindByCompanyID(companyID uuid.UUID) (*models.IntelDossier, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.dossiers {
		if m.dossiers[i].CompanyID == companyID {
			d := m.dossiers[i]
			return &d, nil
		}
	}
	return nil, nil
}

func (m *memDossierRepo) CreateIntelDossier(dossier *models.IntelDossier) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	dossier.ID = uuid.New()
	m.dossiers = append(m.dossiers, *dossier)
	return nil
}

func (m *memDossierRepo) AddMatrixEntry(entry models.DossierMatrixEntry) error { return nil }
func (m *memDossierRepo) AddChallenge(v models.DossierChallenge) (*models.DossierChallenge, error) {
	return &v, nil
}
func (m *memDossierRepo) AddChallengeGap(gap models.DossierChallengeGap) error { return nil }
func (m *memDossierRepo) AddStrikePlan(sp models.DossierStrikePlan) error      { return nil }

type memSessionRepo struct {
	mu       sync.Mutex
	sessions []models.ChatSession
}

func (m *memSessionRepo) FindAll() ([]models.ChatSession, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]models.ChatSession(nil), m.sessions...), nil
}

func (m *memSessionRepo) Create(session models.ChatSession) (*models.ChatSession, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if session.ID == uuid.Nil {
		session.ID = uuid.New()
	}
	m.sessions = append(m.sessions, session)
	return &session, nil
}

func (m *memSessionRepo) FindByID(sessionID uuid.UUID) (*models.ChatSession, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.sessions {
		if m.sessions[i].ID == sessionID {
			s := m.sessions[i]
			return &s, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *memSessionRepo) UpdateTitle(sessionID uuid.UUID, title string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.sessions {
		if m.sessions[i].ID == sessionID {
			m.sessions[i].Title = title
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

func (m *memSessionRepo) Delete(sessionID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.sessions {
		if m.sessions[i].ID == sessionID {
			m.sessions = append(m.sessions[:i], m.sessions[i+1:]...)
			return nil
		}
	}
	return gorm.ErrRecordNotFound
}

type memMessageRepo struct {
	mu       sync.Mutex
	messages []models.ChatMessage
}

func (m *memMessageRepo) FindBySessionID(sessionID uuid.UUID) ([]models.ChatMessage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []models.ChatMessage
	for _, msg := range m.messages {
		if msg.SessionID == sessionID {
			out = append(out, msg)
		}
	}
	return out, nil
}

func (m *memMessageRepo) FindMainBySessionID(sessionID uuid.UUID) ([]models.ChatMessage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []models.ChatMessage
	for _, msg := range m.messages {
		if msg.SessionID == sessionID && (msg.TabID == "" || msg.TabID == "main") {
			out = append(out, msg)
		}
	}
	return out, nil
}

func (m *memMessageRepo) NextSortOrder(sessionID uuid.UUID) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	max := -1
	for _, msg := range m.messages {
		if msg.SessionID == sessionID && msg.SortOrder > max {
			max = msg.SortOrder
		}
	}
	return max + 1, nil
}

func (m *memMessageRepo) Add(msg models.ChatMessage) (*models.ChatMessage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	msg.ID = uuid.New()
	m.messages = append(m.messages, msg)
	return &msg, nil
}

type memSessionCompetitorRepo struct {
	mu    sync.Mutex
	links []models.SessionCompetitor
}

func (m *memSessionCompetitorRepo) FindBySessionID(id uuid.UUID) ([]models.SessionCompetitor, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []models.SessionCompetitor
	for _, l := range m.links {
		if l.SessionID == id {
			out = append(out, l)
		}
	}
	return out, nil
}

func (m *memSessionCompetitorRepo) Add(sc models.SessionCompetitor) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.links = append(m.links, sc)
	return nil
}

func (m *memSessionCompetitorRepo) Exists(sessionID, competitorID uuid.UUID) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, l := range m.links {
		if l.SessionID == sessionID && l.CompetitorID == competitorID {
			return true, nil
		}
	}
	return false, nil
}
