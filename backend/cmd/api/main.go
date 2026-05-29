package main

import (
	"fmt"
	"log"

	// Fiber core and its official middlewares
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"

	// project's internal layers
	"github.com/vedansh-5/waveform/backend/internal/config"
	"github.com/vedansh-5/waveform/backend/internal/handler"
	"github.com/vedansh-5/waveform/backend/internal/middleware"
	"github.com/vedansh-5/waveform/backend/internal/repository"
	"github.com/vedansh-5/waveform/backend/internal/service"
	"github.com/vedansh-5/waveform/backend/internal/storage"
)

func main() {
	// load configuration
	cfg := config.Load()

	// init db pool
	if cfg.DatabaseURL == "" {
		log.Fatal("Fatal: DATABASE_URL is not set in environment or .env file")
	}
	dbPool, err := repository.InitDBPool(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Fatal database error: %v", err)
	}
	defer func() {
		log.Println("Closing database connection pool...")
		dbPool.Close()
	}()

	// Instantiate Clean Architecture Layers
	userRepo := repository.NewUserRepository(dbPool)
	recordingRepo := repository.NewRecordingRepository(dbPool)

	userService := service.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService, cfg)
	oauthHandler := handler.NewOAuthHandler(userService, cfg)
	var storageClient storage.StorageClient
	if cfg.R2AccountID != "" {
		var sErr error
		storageClient, sErr = storage.NewR2StorageClient(cfg)
		if sErr != nil {
			log.Printf("Warning: R2 Storage client failed: %v", sErr)
		}
	}
	recordingHandler := handler.NewRecordingHandler(recordingRepo, storageClient)

	// create fiber app instance
	app := fiber.New(fiber.Config{
		AppName:      "WaveForm Engine Core API",
		ServerHeader: "WaveForm-GO-API",
	})

	// register global middlewares
	app.Use(recover.New()) // Safely recovers from panics in endpoints

	// Fiber's native CORS middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000," + cfg.FrontendURL,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: true, // Enables sending secure session cookies
	}))

	// register routes

	// app healthcheck endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		ctx := c.UserContext()

		if err := dbPool.Ping(ctx); err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"status":      "unhealthy",
				"database":    "disconnected",
				"db_feedback": err.Error(),
			})
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"status":   "healthy",
			"database": "connected",
			"message":  "WaveForm Backend core is running",
		})
	})

	// public auth endpoints
	app.Post("/signup", userHandler.Register)
	app.Post("/login", userHandler.Login)

	// google OAuth endpoints
	app.Get("/auth/google", oauthHandler.GoogleLogin)
	app.Get("/auth/google/callback", oauthHandler.GoogleCallback)

	// profile endpoint - with middleware (JWT)
	app.Get("/me", middleware.Protected(cfg), userHandler.Me)

	// Protected Audio Upload & Mathematical Querying Routes
	app.Post("/recordings", middleware.Protected(cfg), recordingHandler.Upload)
	app.Get("/recordings", middleware.Protected(cfg), recordingHandler.GetHistory)
	app.Get("/uploads/:filepath", recordingHandler.DownloadFile) // Public downloader route

	// start fiber web server
	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting WaveForm server on %s [%s environment]...", serverAddr, cfg.Env)
	if err := app.Listen(serverAddr); err != nil {
		log.Fatalf("Fatal: Web server failed to run: %v", err)
	}
}
