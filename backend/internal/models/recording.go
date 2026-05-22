package models

import "time"

type Recording struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	FilePath  string    `json:"file_path"`
	FileSize  int       `json:"file_size"`
	Duration  float64   `json:"duration"`
	CreatedAt time.Time `json:"created_at"`
}

type Equation struct {
	ID                   string    `json:"id"`
	RecordingID          string    `json:"recording_id"`
	A0                   float64   `json:"a_0"`
	An                   []float64 `json:"a_n"`
	Bn                   []float64 `json:"b_n"`
	FundamentalFrequency float64   `json:"fundamental_frequency"`
	CreatedAt            time.Time `json:"created_at"`
}

// CompleteCompositeWave represents the fully loaded database model for the client
type CompleteCompositeWave struct {
	Recording Recording `json:"recording"`
	Equation  Equation  `json:"equation"`
}
