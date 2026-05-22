package service

import (
	"context"
	"errors"
	"strings"

	"github.com/vedansh-5/waveform/backend/internal/models"
	"github.com/vedansh-5/waveform/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

// Shared errors for consistency
var (
	ErrUserAlreadyExists  = errors.New("a user with this email address already exists")
	ErrInvalidCredentials = errors.New("invalid email address or password")
	ErrInvalidInput       = errors.New("invalid input provided")
)

type UserService interface {
	Register(ctx context.Context, name, email, password string) (*models.User, error)
	Login(ctx context.Context, email, password string) (*models.User, error)
	GetProfile(ctx context.Context, userID string) (*models.User, error)
	LoginOrRegisterOAuth(ctx context.Context, provider, providerID, email, name, avatarURL string) (*models.User, error)
}

type userService struct {
	userRepo repository.UserRepository
}

func NewUserService(userRepo repository.UserRepository) UserService {
	return &userService{userRepo: userRepo}
}

func (s *userService) Register(ctx context.Context, name, email, password string) (*models.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	name = strings.TrimSpace(name)

	// Validate inputs
	if email == "" || name == "" || len(password) < 6 {
		return nil, ErrInvalidInput
	}

	// 1. Ensure user is unique
	existingUser, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if existingUser != nil {
		return nil, ErrUserAlreadyExists
	}

	// 2. Encrypt Password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	newUser := &models.User{
		Email:        email,
		PasswordHash: string(hashedPassword),
		Name:         name,
		AvatarURL:    "https://api.dicebear.com/7.x/bottts/svg?seed=" + name, // Dynamic user avatar seed!
	}

	// 3. Create in Database
	if err := s.userRepo.Create(ctx, newUser); err != nil {
		return nil, err
	}

	return newUser, nil
}

func (s *userService) Login(ctx context.Context, email, password string) (*models.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))

	if email == "" || password == "" {
		return nil, ErrInvalidCredentials
	}

	// 1. Fetch from repository
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}

	// 2. Compare user password hash with input using constant-time comparison (prevents timing attacks!)
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	return user, nil
}

func (s *userService) GetProfile(ctx context.Context, userID string) (*models.User, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user profile not found")
	}
	return user, nil
}

func (s *userService) LoginOrRegisterOAuth(ctx context.Context, provider, providerID, email, name, avatarURL string) (*models.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))

	// 1. Fetch user by email
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	if user != nil {
		// User exists! If they haven't linked their OAuth fields, we link them
		if user.OAuthProvider == "" {
			user.OAuthProvider = provider
			user.OAuthID = providerID
		}
		return user, nil
	}

	// 2. User doesn't exist, create a new OAuth record
	newUser := &models.User{
		Email:         email,
		Name:          name,
		AvatarURL:     avatarURL,
		OAuthProvider: provider,
		OAuthID:       providerID,
		PasswordHash:  "", // OAuth logins have empty local password hash
	}

	if err := s.userRepo.Create(ctx, newUser); err != nil {
		return nil, err
	}

	return newUser, nil
}
