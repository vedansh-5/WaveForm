package handler

import (
	"bytes"
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
	"github.com/vedansh-5/waveform/backend/internal/storage"
)

type RecordingHandler struct {
	repo    repository.RecordingRepository
	storage storage.StorageClient
}

func NewRecordingHandler(repo repository.RecordingRepository, storage storage.StorageClient) *RecordingHandler {
	// Create local upload folder if missing
	return &RecordingHandler{
		repo:    repo,
		storage: storage,
	}
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
	// 2. Hardware/Mathematical Duration Validation (Trim to 30s if exceeded)
	duration := float64(len(wave.Samples)) / float64(wave.SampleRate)

	// Generate unique name
	uniqueFilename := fmt.Sprintf("%s.wav", uuid.New().String())
	storagePath := filepath.Join("uploads", uniqueFilename)
	var uploadReader io.Reader
	var finalSize int
	maxSamples := 30 * wave.SampleRate
	if len(wave.Samples) > maxSamples {
		wave.Samples = wave.Samples[:maxSamples]
		duration = 30.0
		var buf bytes.Buffer
		if err := dsp.WriteWAV(&buf, wave); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to write trimmed WAV file"})
		}
		finalSize = buf.Len()
		uploadReader = &buf
	} else {
		_, _ = file.Seek(0, io.SeekStart)
		var buf bytes.Buffer
		if _, err := io.Copy(&buf, file); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save data stream"})
		}
		finalSize = buf.Len()
		uploadReader = &buf
	}
	// Persist the audio file (Cloudflare R2 stream with local fallback)
	if h.storage != nil {
		_, err := h.storage.UploadFile(ctx, uniqueFilename, uploadReader, "audio/wav")
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "failed to upload audio to Cloudflare R2",
				"details": err.Error(),
			})
		}
	} else {
		_ = os.MkdirAll("./uploads", 0755)
		outFile, err := os.Create(storagePath)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to persist audio to disk"})
		}
		defer outFile.Close()
		if _, err := io.Copy(outFile, uploadReader); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to write to local storage"})
		}
	}
	// 3. Compute Fourier Coefficients (12 Harmonics)
	harmonicsLimit := 12
	coefficients, err := dsp.SolveFourierSeries(wave.Samples, wave.SampleRate, harmonicsLimit)
	if err != nil {
		if h.storage == nil {
			_ = os.Remove(storagePath)
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Fourier DSP solver crashed"})
	}
	// Save metadata and equation structures
	recording := models.Recording{
		UserID:   userID,
		Title:    title,
		FilePath: storagePath,
		FileSize: finalSize,
		Duration: math.Round(duration*100) / 100,
	}
	equation := models.Equation{
		A0:                   coefficients.A0,
		An:                   coefficients.An,
		Bn:                   coefficients.Bn,
		FundamentalFrequency: coefficients.FundamentalFrequency,
	}
	if err := h.repo.Save(ctx, &recording, &equation); err != nil {
		if h.storage == nil {
			_ = os.Remove(storagePath)
		}
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
	filePath := c.Params("filepath")
	// Redirect to direct CDN if R2 is active (0 bandwidth cost for backend!)
	if h.storage != nil {
		return c.Redirect(h.storage.GetPublicURL(filePath), fiber.StatusFound)
	}
	cleanPath := filepath.Clean(filepath.Join("uploads", filePath))
	if _, err := os.Stat(cleanPath); os.IsNotExist(err) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "file not found"})
	}
	return c.Download(cleanPath)
}
