package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vedansh-5/waveform/backend/internal/models"
)

type RecordingRepository interface {
	Save(ctx context.Context, rec *models.Recording, eq *models.Equation) error
	GetByUserID(ctx context.Context, userID string) ([]models.CompleteCompositeWave, error)
	GetByID(ctx context.Context, id string) (*models.CompleteCompositeWave, error)
}

type postgresRecordingRepository struct {
	db *pgxpool.Pool
}

func NewRecordingRepository(db *pgxpool.Pool) RecordingRepository {
	return &postgresRecordingRepository{db: db}
}

func (r *postgresRecordingRepository) Save(ctx context.Context, rec *models.Recording, eq *models.Equation) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// 1. Insert Recording
	recQuery := `
		INSERT INTO recordings (user_id, title, file_path, file_size, duration)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`
	err = tx.QueryRow(ctx, recQuery, rec.UserID, rec.Title, rec.FilePath, rec.FileSize, rec.Duration).
		Scan(&rec.ID, &rec.CreatedAt)
	if err != nil {
		return err
	}
	// 2. Insert Equation using the returned recording ID
	eq.RecordingID = rec.ID
	eqQuery := `
		INSERT INTO equations (recording_id, a_0, a_n, b_n, fundamental_frequency)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`
	err = tx.QueryRow(ctx, eqQuery, eq.RecordingID, eq.A0, eq.An, eq.Bn, eq.FundamentalFrequency).
		Scan(&eq.ID, &eq.CreatedAt)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *postgresRecordingRepository) GetByUserID(ctx context.Context, userID string) ([]models.CompleteCompositeWave, error) {
	query := `
		SELECT 
			r.id, r.user_id, r.title, r.file_path, r.file_size, r.duration, r.created_at,
			e.id, e.recording_id, e.a_0, e.a_n, e.b_n, e.fundamental_frequency, e.created_at
		FROM recordings r
		INNER JOIN equations e ON r.id = e.recording_id
		WHERE r.user_id = $1
		ORDER BY r.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []models.CompleteCompositeWave
	for rows.Next() {
		var w models.CompleteCompositeWave
		err := rows.Scan(
			&w.Recording.ID, &w.Recording.UserID, &w.Recording.Title, &w.Recording.FilePath, &w.Recording.FileSize, &w.Recording.Duration, &w.Recording.CreatedAt,
			&w.Equation.ID, &w.Equation.RecordingID, &w.Equation.A0, &w.Equation.An, &w.Equation.Bn, &w.Equation.FundamentalFrequency, &w.Equation.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, w)
	}
	return results, nil
}

func (r *postgresRecordingRepository) GetByID(ctx context.Context, id string) (*models.CompleteCompositeWave, error) {
	query := `
		SELECT 
			r.id, r.user_id, r.title, r.file_path, r.file_size, r.duration, r.created_at,
			e.id, e.recording_id, e.a_0, e.a_n, e.b_n, e.fundamental_frequency, e.created_at
		FROM recordings r
		INNER JOIN equations e ON r.id = e.recording_id
		WHERE r.id = $1
	`
	var w models.CompleteCompositeWave
	err := r.db.QueryRow(ctx, query, id).Scan(
		&w.Recording.ID, &w.Recording.UserID, &w.Recording.Title, &w.Recording.FilePath, &w.Recording.FileSize, &w.Recording.Duration, &w.Recording.CreatedAt,
		&w.Equation.ID, &w.Equation.RecordingID, &w.Equation.A0, &w.Equation.An, &w.Equation.Bn, &w.Equation.FundamentalFrequency, &w.Equation.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &w, nil
}
