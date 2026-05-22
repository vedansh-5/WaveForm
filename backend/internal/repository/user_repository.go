package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vedansh-5/waveform/backend/internal/models"
)

// define strict interface contract for data querying
type UserRepository interface {
	Create(ctx context.Context, user *models.User) error
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	GetByID(ctx context.Context, id string) (*models.User, error)
}

type postgresUserRepository struct {
	db *pgxpool.Pool
}

// NewUserRepository acts as a constructor dependency injection point.
func NewUserRepository(db *pgxpool.Pool) UserRepository {
	return &postgresUserRepository{db: db}
}

// Create inserts a new User and retrieves their generated DB UUID
func (r *postgresUserRepository) Create(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (email, password_hash, name, avatar_url, oauth_provider, oauth_id)	
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`
	err := r.db.QueryRow(ctx, query,
		user.Email,
		user.PasswordHash,
		user.Name,
		user.AvatarURL,
		user.OAuthProvider,
		user.OAuthID,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
	return err
}

// GetByEmail retrieves a user by their email address. Returns (nil, nil) if not found.
func (r *postgresUserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
			SELECT id, email, password_hash, name, avatar_url, oauth_provider, oauth_id, created_at, updated_at
			FROM users
			WHERE email = $1
	`
	var user models.User
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.AvatarURL,
		&user.OAuthProvider,
		&user.OAuthID,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // not an error, just returning empty user
		}
		return nil, err
	}
	return &user, nil
}

// GetByID fetches a specific user by their database UUID.
func (r *postgresUserRepository) GetByID(ctx context.Context, id string) (*models.User, error) {
	query := `
			SELECT id, email, password_hash, name, avatar_url, oauth_provider, oauth_id, created_at, updated_at
			FROM users
			WHERE id = $1
	`

	var user models.User
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.Name,
		&user.AvatarURL,
		&user.OAuthProvider,
		&user.OAuthID,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}
