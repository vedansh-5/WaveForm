package handler

import (
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/vedansh-5/waveform/backend/internal/dsp"
	"github.com/vedansh-5/waveform/backend/internal/models"
	"github.com/vedansh-5/waveform/backend/internal/repository"
)

type RecordingHandler struct {
	repo repository.RecordingRepository
}

func NewRecordingHandler(repo repository.RecordingRepository) *RecordingHandler {
	// Create local upload folder if missing
	_ = os.MkdirAll("./uploads", 0755)
	return &RecordingHandler{repo: repo}
}

func (h *RecordingHandler) Upload(c *fiber.Ctx) error {
	ctx := c.UserContext()
	userID := c.Locals("user_id").(string) // Injected from JWT verification middleware
	// Retrieve multi-part file details
	fileHeader, err := c.FormFile("audio")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing audio form parameter"})
	}
	title := c.FormValue("title")
	if title == "" {
		title = fmt.Sprintf("Recording %s", time.Now().Format("2006-01-02 15:04"))
	}
	// 1. Strict File Size Validation (Max 10MB)
	if fileHeader.Size > 10*1024*1024 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "audio file payload exceeds maximum allowed size (10MB)"})
	}
	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read uploaded audio stream"})
	}
	defer file.Close()
	// Parse audio metadata and samples
	wave, err := dsp.ParseWAV(file)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "WAV decoding failed",
			"details": err.Error(),
		})
	}
	// 2. Hardware/Mathematical Duration Validation (Max 30s)
	duration := float64(len(wave.Samples)) / float64(wave.SampleRate)
	if duration > 30.5 { // Add a minor 500ms safety buffer
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":    "Duration exceeded maximum limit",
			"duration": math.Round(duration*100) / 100,
			"limit":    "30 seconds",
		})
	}
	// Rewind the file cursor to copy it to local storage
	_, _ = file.Seek(0, io.SeekStart)
	// Save to local filesystem
	uniqueFilename := fmt.Sprintf("%s.wav", uuid.New().String())
	storagePath := filepath.Join("uploads", uniqueFilename)
	outFile, err := os.Create(storagePath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to persist audio to disk"})
	}
	defer outFile.Close()
	if _, err := io.Copy(outFile, file); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save data stream"})
	}
	// 3. Compute Fourier Coefficients (12 Harmonics)
	harmonicsLimit := 12
	coefficients, err := dsp.SolveFourierSeries(wave.Samples, wave.SampleRate, harmonicsLimit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Fourier DSP solver crashed"})
	}
	// Save metadata and equation structures
	recording := models.Recording{
		UserID:   userID,
		Title:    title,
		FilePath: storagePath,
		FileSize: int(fileHeader.Size),
		Duration: math.Round(duration*100) / 100,
	}
	equation := models.Equation{
		A0:                   coefficients.A0,
		An:                   coefficients.An,
		Bn:                   coefficients.Bn,
		FundamentalFrequency: coefficients.FundamentalFrequency,
	}
	if err := h.repo.Save(ctx, &recording, &equation); err != nil {
		_ = os.Remove(storagePath) // Delete file if database write fails
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to save records to database",
			"details": err.Error(),
		})
	}
	return c.Status(fiber.StatusCreated).JSON(models.CompleteCompositeWave{
		Recording: recording,
		Equation:  equation,
	})
}
func (h *RecordingHandler) GetHistory(c *fiber.Ctx) error {
	ctx := c.UserContext()
	userID := c.Locals("user_id").(string)
	history, err := h.repo.GetByUserID(ctx, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to retrieve session history"})
	}
	return c.JSON(history)
}
func (h *RecordingHandler) DownloadFile(c *fiber.Ctx) error {
	// Serve raw WAV data for user playback
	filePath := c.Params("filepath")
	cleanPath := filepath.Clean(filepath.Join("uploads", filePath))

	if _, err := os.Stat(cleanPath); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "file not found"})
	}
	return c.Download(cleanPath)
}
