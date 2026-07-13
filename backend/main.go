package main

import (
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	api "github.com/rpupo63/report-backend/api"
	"github.com/rpupo63/report-backend/database"
	"github.com/rpupo63/report-backend/models"
	"github.com/rpupo63/report-backend/services"
	"github.com/rpupo63/report-backend/services/fakes"
)

// GormLogger implements gorm.io/gorm/logger.Writer interface using zerolog.
type GormLogger struct {
	zerolog.Logger
}

// Printf implements gorm.io/gorm/logger.Writer
func (l GormLogger) Printf(format string, v ...interface{}) {
	l.Logger.Error().Msgf(format, v...)
}

func main() {
	// Configure zerolog to write all logs to os.Stderr for immediate visibility
	log.Logger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stderr, NoColor: false}).With().Timestamp().Logger()
	zerolog.SetGlobalLevel(zerolog.WarnLevel)
	log.Info().Msg("Server started and zerolog configured (logging to stderr).")

	fmt.Println("Initializing Report backend...")

	if err := godotenv.Load(); err != nil {
		log.Info().Err(err).Msg("No .env file found (using system environment variables)")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal().Msg("DATABASE_URL environment variable is required")
	}

	newLogger := logger.New(
		GormLogger{log.Logger}, // Use zerolog for GORM logging
		logger.Config{
			SlowThreshold:             1000 * time.Millisecond,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false, // Set to false since zerolog handles colors
		},
	)

	fmt.Println("Connecting to database...")

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true, // avoids prepared-statement cache conflicts on reconnect
	}), &gorm.Config{
		Logger: newLogger,
	})
	if err != nil {
		log.Fatal().Err(err).Msg("Error connecting to database")
	}

	// Enable uuid-ossp extension
	if err := db.Exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`).Error; err != nil {
		log.Fatal().Err(err).Msg("Error enabling uuid-ossp extension")
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal().Err(err).Msg("Error getting generic database object")
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := sqlDB.Ping(); err != nil {
		log.Fatal().Err(err).Msg("Error pinging database")
	}
	fmt.Println("Connected to database successfully")

	if os.Getenv("GENERATE_MODELS") != "false" {
		log.Info().Msg("Auto-migrating models (set GENERATE_MODELS=false to skip)...")
		// Auto-migrate all models — additive only, never drops columns or tables
		if err := db.AutoMigrate(
			&models.Company{},
			&models.Competitor{},
			&models.CompetitorKeyProduct{},
			&models.CompetitorChallenge{},
			&models.CompetitorReasoning{},
			&models.IntelDossier{},
			&models.DossierMatrixEntry{},
			&models.DossierChallenge{},
			&models.DossierChallengeGap{},
			&models.DossierStrikePlan{},
			&models.ChatSession{},
			&models.ChatMessage{},
			&models.SessionCompetitor{},
		); err != nil && !strings.Contains(err.Error(), "already exists") {
			log.Fatal().Err(err).Msg("Error running auto-migration")
		}
	} else {
		log.Info().Msg("GENERATE_MODELS=false, skipping auto-migration.")
	}

	currentDB := database.New(db)

	var (
		llmClient    services.LLMClientInterface
		serpClient   services.SerpProvider
		enrichClient services.EnrichProvider
	)
	if os.Getenv("FAKE_PROVIDERS") == "true" {
		log.Warn().Msg("FAKE_PROVIDERS=true — using deterministic fake LLM/SERP/Enrich providers (testing only)")
		llmClient = fakes.NewFakeLLM()
		serpClient = fakes.NewFakeSerp()
		enrichClient = fakes.NewFakeEnrich()
	} else {
		realLLM := services.NewLLMClient(os.Getenv("GEMINI_API_KEY"))
		if realLLM == nil {
			log.Fatal().Msg("GEMINI_API_KEY environment variable is required to initialize LLMClient")
		}
		llmClient = realLLM
		serpClient = services.NewSerpClient(os.Getenv("SERP_API_KEY"), llmClient)
		enrichClient = services.NewEnrichClient(os.Getenv("ENRICH_API_KEY"))
	}

	startServer(currentDB, llmClient, serpClient, enrichClient)
}

func startServer(db database.Database, llmClient services.LLMClientInterface, serpClient services.SerpProvider, enrichClient services.EnrichProvider) {
	errChannel := make(chan error)
	defer close(errChannel)

	server, err := api.NewServer(db, llmClient, serpClient, enrichClient)
	if err != nil {
		log.Fatal().Err(err).Msg("Error initializing server")
	}

	go server.Start(errChannel)
	go listenToInterrupt(errChannel)

	fatalErr := <-errChannel
	fmt.Printf("Closing server: %v\n", fatalErr)

	server.ShutdownGracefully(30 * time.Second)
}

func listenToInterrupt(errChannel chan<- error) {
	c := make(chan os.Signal, 1)
	signal.Notify(c, syscall.SIGINT, syscall.SIGTERM)
	errChannel <- fmt.Errorf("%s", <-c)
}
