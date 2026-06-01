package repository

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// init a robust pgx connection pool with health checking
func InitDBPool(databaseURL string) (*pgxpool.Pool, error) {
	// handshake timeout of 5s

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// parse db url string into full configuration
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse database url: %w", err)
	}

	// Disable prepared statement cache to ensure full compatibility with
	// connection poolers like PgBouncer in transaction mode (Render, Supabase, Neon)
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	// connection pooling setup prevents connection resource leaks
	config.MaxConns = 10                      // max nos of active connection in pool
	config.MinConns = 2                       // min idle connections to keep open
	config.MaxConnIdleTime = 30 * time.Minute // terminate idle connection after 30 min
	config.MaxConnLifetime = 1 * time.Hour    // recycle active connections

	// establish connection pool
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	// ping to check if db is online and accepting creds

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db connection handshake failed: %w", err)
	}
	log.Println("Secure postgres connection pool initialized successfully with pgx!")
	return pool, nil
}
