package models

// AllModels returns a slice of all GORM models in the application.
func AllModels() []interface{} {
	return []interface{}{
		&ChatMessage{},
		&ChatSession{},
		&Company{},
		&Competitor{},
		&CompetitorKeyProduct{},
		&CompetitorChallenge{},
		&CompetitorReasoning{},
		&IntelDossier{},
		&DossierMatrixEntry{},
		&DossierChallenge{},
		&DossierChallengeGap{},
		&DossierStrikePlan{},
		&SessionCompetitor{},
	}
}
