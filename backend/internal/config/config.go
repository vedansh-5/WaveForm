package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// config holds all environment variables

type Config struct {
	Port               string
	Env                string
	DatabaseURL        string
	JWTSecret          string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
}

// Load reads config from local .env or system env variables in prod
func Load() *Config {
	// attempt to load .env in dev. Don't crash if it fails - wont exist in prodution container
	if err := godotenv.Load(); err != nil {
		log.Println("Info: No local .env file found. Reading directly from system environment.")
	}

	return &Config{
		Port:               getEnv("PORT", "8080"),
		Env:                getEnv("ENV", "development"),
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		JWTSecret:          getEnv("JWT_SECRET", "change_me_default_secret_key_vedansh_builds"),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", ""),
	}
}

// helper to get vars or return custom default values
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
