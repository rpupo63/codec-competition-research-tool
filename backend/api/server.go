package api

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rpupo63/report-backend/config"
	"github.com/rpupo63/report-backend/database"
	"github.com/rpupo63/report-backend/services"
	"github.com/rs/zerolog/log"
)

type Server struct {
	*http.Server
	startupTime time.Time
}

func NewServer(database database.Database, llmClient services.LLMClientInterface) (Server, error) {
	c := config.New()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	address := "0.0.0.0:" + port

	startupTime := time.Now()

	router := newRouter(database, llmClient, withConfig(c), withStartupTime(startupTime))

	readTimeout := 180 * time.Second
	writeTimeout := 180 * time.Second
	idleTimeout := 180 * time.Second

	server := &http.Server{
		Addr:         address,
		Handler:      router,
		ReadTimeout:  readTimeout,
		WriteTimeout: writeTimeout,
		IdleTimeout:  idleTimeout,
	}

	return Server{server, startupTime}, nil
}

type router struct {
	config      map[string]string
	startupTime time.Time
}

func withConfig(c map[string]string) func(*router) {
	return func(r *router) {
		r.config = c
	}
}

func withStartupTime(startupTime time.Time) func(*router) {
	return func(r *router) {
		r.startupTime = startupTime
	}
}

func newRouter(database database.Database, llmClient services.LLMClientInterface, opts ...func(*router)) *chi.Mux {
	var router router
	for _, opt := range opts {
		opt(&router)
	}

	chiRouter := chi.NewRouter()
	// chiRouter.Use(LogInternalServerErrors)

	acceptedOrigins := strings.Split(os.Getenv("ACCEPTED_ORIGINS"), ",")
	log.Info().Msgf("Accepted Origins: %v", acceptedOrigins)
	chiRouter.Use(CORSCheckMiddleware(log.Logger, acceptedOrigins))
	chiRouter.Use(corsMiddleware(acceptedOrigins))

	handlers := initializeHandlers(database, llmClient)
	apiRouter := chi.NewRouter()
	setupRoutes(apiRouter, handlers)
	chiRouter.Mount("/api", apiRouter)

	chiRouter.Get("/", rootHandler())
	chiRouter.Get("/healthcheck", healthcheckHandler(router.startupTime))

	return chiRouter
}

func (s Server) Start(errChannel chan<- error) {
	fmt.Println("Server started on: %s", s.Addr)
	errChannel <- s.ListenAndServe()
}

func (s Server) ShutdownGracefully(timeout time.Duration) {
	log.Info().Msg("Gracefully shutting down...")

	gracefullCtx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	if err := s.Shutdown(gracefullCtx); err != nil {
		log.Error().Msgf("Error shutting down the server: %v", err)
	} else {
		log.Info().Msg("HttpServer gracefully shut down")
	}
}

func rootHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Powered-By", "Arch Linux (btw)")
		w.Header().Set("X-Quantum-State", "Superposition")

		quotes := []string{
			"SYSTEM STATUS: ONLINE. \nWARNING: Cat detected in server room.",
			"EXECUTION STRATEGY: One way out.",
			"QUANTUM COHERENCE: 99.9%. \nWavefunction has not yet collapsed.",
			"HYPRLAND CONFIG: Loaded. \nTile Layout: Dwindle.",
			"TARGET: The Witness. \nPuzzle status: Unsolved.",
		}

		rand.Seed(time.Now().UnixNano())
		selectedQuote := quotes[rand.Intn(len(quotes))]

		userAgent := r.Header.Get("User-Agent")
		if !strings.Contains(userAgent, "curl") {
			w.Header().Set("Content-Type", "text/html")
			html := fmt.Sprintf(`
        <html>
        <body style="background:#1e1e2e; color:#cdd6f4; font-family: monospace; display:flex; align-items:center; justify-content:center; height:100vh;">
            <div style="border: 1px solid #fab387; padding: 20px; border-radius: 5px;">
                	<p style="color:#fab387;">root@report-backend:~# ./status</p>                <p>%s</p>
                <span style="animation: blink 1s infinite;">_</span>
            </div>
            <style>@keyframes blink{50%%{opacity:0;}}</style>
        </body>
        </html>`, selectedQuote)
			w.Write([]byte(html))
			return
		}

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Write([]byte(selectedQuote + "\n"))
	}
}

func healthcheckHandler(startupTime time.Time) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		response := map[string]interface{}{
			"current_time":   time.Now().Format(time.RFC3339),
			"startup_time":   startupTime.Format(time.RFC3339),
			"uptime_seconds": int(time.Since(startupTime).Seconds()),
		}

		if err := json.NewEncoder(w).Encode(response); err != nil {
			log.Error().Err(err).Msg("Error encoding healthcheck response")
			w.WriteHeader(http.StatusInternalServerError)
		}
	}
}
