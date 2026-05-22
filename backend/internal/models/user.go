package models

import "time"

type User struct {
	ID            string    `json:"id"`
	Email         string    `json:"email"`
	PasswordHash  string    `json:"-"` // json:"-" prevents password hashes from being leaked
	Name          string    `json:"name"`
	AvatarURL     string    `json:"avatar_url"`
	OAuthProvider string    `json:"oauth_provider,omitempty"`
	OAuthID       string    `json:"oauth_id,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
