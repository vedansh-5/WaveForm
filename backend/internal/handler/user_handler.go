package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/vedansh-5/waveform/backend/internal/config"
	"github.com/vedansh-5/waveform/backend/internal/middleware"
	"github.com/vedansh-5/waveform/backend/internal/service"
)

type UserHandler struct {
	userService service.UserService
	cfg         *config.Config
}

func NewUserHandler(userService service.UserService, cfg *config.Config) *UserHandler {
	return &UserHandler{
		userService: userService,
		cfg:         cfg,
	}
}

type registerRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequeset struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *UserHandler) Register(c *fiber.Ctx) error {
	var req registerRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body format",
		})
	}

	ctx := c.UserContext()
	user, err := h.userService.Register(ctx, req.Name, req.Email, req.Password)
	if err != nil {
		status := fiber.StatusInternalServerError
		if err == service.ErrInvalidInput || err == service.ErrUserAlreadyExists {
			status = fiber.StatusBadRequest
		}
		return c.Status(status).JSON(fiber.Map{
			"error": err.Error(),
		})
	}
	token, err := middleware.GenerateToken(user.ID, req.Email, h.cfg.JWTSecret)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to issue security token",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"user":  user,
		"token": token,
	})
}

func (h *UserHandler) Login(c *fiber.Ctx) error {
	var req loginRequeset
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body format",
		})
	}

	ctx := c.UserContext()
	user, err := h.userService.Login(ctx, req.Email, req.Password)
	if err != nil {
		status := fiber.StatusInternalServerError
		if err == service.ErrInvalidCredentials {
			status = fiber.StatusUnauthorized
		}
		return c.Status(status).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	// issue jwt upon successful login

	token, err := middleware.GenerateToken(user.ID, user.Email, h.cfg.JWTSecret)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to issue security token",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"user":  user,
		"token": token,
	})
}

func (h *UserHandler) Me(c *fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized request context",
		})
	}
	ctx := c.UserContext()
	user, err := h.userService.GetProfile(ctx, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": err.Error(),
		})
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"user": user,
	})
}
