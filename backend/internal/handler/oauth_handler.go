package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/gofiber/fiber/v2"
	"github.com/vedansh-5/waveform/backend/internal/config"
	"github.com/vedansh-5/waveform/backend/internal/middleware"
	"github.com/vedansh-5/waveform/backend/internal/service"
)

type OAuthHandler struct {
	userService service.UserService
	cfg         *config.Config
}

func NewOAuthHandler(userService service.UserService, cfg *config.Config) *OAuthHandler {
	return &OAuthHandler{
		userService: userService,
		cfg:         cfg,
	}
}

type googleTokenResponse struct {
	AccessToken string `json:"access_token"`
	IDToken     string `json:"id_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

type googleUserInfo struct {
	Sub           string `json:"sub"` // Google's unique user identifier
	Email         string `json:"email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"` // Avatar URL
	EmailVerified bool   `json:"email_verified"`
}

// GoogleLogin redirects the user's browser to the Google OAuth consent page
func (h *OAuthHandler) GoogleLogin(c *fiber.Ctx) error {
	googleAuthURL := "https://accounts.google.com/o/oauth2/v2/auth"

	u, _ := url.Parse(googleAuthURL)
	q := u.Query()
	q.Set("client_id", h.cfg.GoogleClientID)
	q.Set("redirect_uri", h.cfg.GoogleRedirectURL)
	q.Set("response_type", "code")
	q.Set("scope", "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile")
	q.Set("access_type", "offline")
	q.Set("prompt", "consent")

	u.RawQuery = q.Encode()

	return c.Redirect(u.String(), fiber.StatusTemporaryRedirect)

}

// GoogleCallback processes the callback from Google, exchanges authorization codes,
// stores profile fields in PostgreSQL, and redirects to Next.js with our session JWT.

func (h *OAuthHandler) GoogleCallback(c *fiber.Ctx) error {
	code := c.Query("code")
	if code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "authorization code is missing from callback parameters",
		})
	}

	// exchange auth code for a GAT
	tokenEndpoint := "https://oauth2.googleapis.com/token"

	formValues := url.Values{}
	formValues.Set("code", code)
	formValues.Set("client_id", h.cfg.GoogleClientID)
	formValues.Set("client_secret", h.cfg.GoogleClientSecret)
	formValues.Set("redirect_uri", h.cfg.GoogleRedirectURL)
	formValues.Set("grant_type", "authorization_code")

	resp, err := http.PostForm(tokenEndpoint, formValues)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("failed to exchange code for token: %v", err),
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("google token exchange returned status: %s", resp.Status),
		})
	}

	var tokenResp googleTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to decode google token response",
		})
	}

	// fetch user profile from google using retrieved access token
	userInfoURL := "https://www.googleapis.com/oauth2/v3/userinfo"
	req, err := http.NewRequest("GET", userInfoURL, nil)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to construct profile request",
		})
	}
	req.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
	client := &http.Client{}
	infoResp, err := client.Do(req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("failed to retrieve user profile: %v", err),
		})
	}
	defer infoResp.Body.Close()
	if infoResp.StatusCode != http.StatusOK {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("google user info api returned status: %s", infoResp.Status),
		})
	}
	var userInfo googleUserInfo
	if err := json.NewDecoder(infoResp.Body).Decode(&userInfo); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to parse user profile json",
		})
	}

	// query postgres, logging in or creating oauth user record

	ctx := c.UserContext()
	user, err := h.userService.LoginOrRegisterOAuth(
		ctx,
		"google",
		userInfo.Sub,
		userInfo.Email,
		userInfo.Name,
		userInfo.Picture,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("database registration or sign-in failed: %v", err),
		})
	}

	// issue our signed backend session jwt token
	ourToken, err := middleware.GenerateToken(user.ID, user.Email, h.cfg.JWTSecret)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to issue backend authentication token",
		})
	}
	frontendURL := h.cfg.FrontendURL
	if frontendURL == "" {
		frontendURL = "https://localhost:3000"
	}

	// Trim any trailing slashes dynamically to avoid URL structure issues
	if len(frontendURL) > 0 && frontendURL[len(frontendURL)-1] == '/' {
		frontendURL = frontendURL[:len(frontendURL)-1]
	}

	// redirect browser back to the Next.js frontend auth callback router
	frontendCallbackURL := fmt.Sprintf("%s/auth/callback?token=%s", frontendURL, ourToken)
	return c.Redirect(frontendCallbackURL, fiber.StatusTemporaryRedirect)
}
