package dsp

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
)

// WaveData parses audio metadata and outputs raw floats normalized to [-1.0, 1.0].
type WaveData struct {
	SampleRate int
	Samples    []float64
}

// EquationCoefficients stores dynamic harmonic expansions for the D3 Epicycle rendering loop
type EquationCoefficients struct {
	A0                   float64   // DC Offset (average amplitude)
	An                   []float64 // Cosine Coefficients
	Bn                   []float64 // Sine Coefficients
	FundamentalFrequency float64   // Core Pitch frequency in Hz
}

// ParseWAV decodes a 16-bit Mono PCM WAV stream from the web payload.
func ParseWAV(r io.Reader) (*WaveData, error) {
	header := make([]byte, 44)
	if _, err := io.ReadFull(r, header); err != nil {
		return nil, fmt.Errorf("failed to read WAV 44-byte header: %w", err)
	}
	// Verify RIFF and WAVE magic signatures
	if string(header[0:4]) != "RIFF" || string(header[8:12]) != "WAVE" {
		return nil, errors.New("uploaded file is not a valid RIFF WAVE document")
	}
	channels := int(binary.LittleEndian.Uint16(header[22:24]))
	sampleRate := int(binary.LittleEndian.Uint32(header[24:28]))
	bitsPerSample := int(binary.LittleEndian.Uint16(header[34:36]))
	if channels != 1 {
		return nil, fmt.Errorf("invalid channel count: expected 1 (mono), got %d", channels)
	}
	if bitsPerSample != 16 {
		return nil, fmt.Errorf("invalid encoding depth: expected 16-bit PCM, got %d-bit", bitsPerSample)
	}
	// Read remainder subchunk data bytes
	rawBytes, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("failed to read PCM sample stream: %w", err)
	}
	sampleCount := len(rawBytes) / 2
	samples := make([]float64, sampleCount)
	for i := 0; i < sampleCount; i++ {
		rawSample := int16(binary.LittleEndian.Uint16(rawBytes[i*2 : (i*2)+2]))
		// Normalize 16-bit signed integer range to floating-point standard [-1.0, 1.0]
		samples[i] = float64(rawSample) / 32768.0
	}
	return &WaveData{
		SampleRate: sampleRate,
		Samples:    samples,
	}, nil
}

// DetectPitchAutocorrelation finds the fundamental pitch using Autocorrelation (ACF)
func DetectPitchAutocorrelation(samples []float64, sampleRate int) (float64, int) {
	n := len(samples)
	if n == 0 {
		return 0.0, 0
	}
	// Restrict frequency searching area to typical human pitch bounds: 80Hz - 1000Hz
	minPeriod := sampleRate / 1000
	maxPeriod := sampleRate / 80
	if maxPeriod >= n {
		maxPeriod = n - 1
	}
	r := make([]float64, maxPeriod+1)
	// Compute autocorrelation coefficients: R(k) = sum(x[t] * x[t+k])
	for k := 0; k <= maxPeriod; k++ {
		sum := 0.0
		for t := 0; t < n-k; t++ {
			sum += samples[t] * samples[t+k]
		}
		r[k] = sum
	}
	// Find the peak of correlation past the initial zero-lag decay
	peakLag := 0
	maxVal := -1.0
	decayPhase := true
	for k := 1; k <= maxPeriod; k++ {
		if decayPhase {
			if r[k] > r[k-1] {
				decayPhase = false
			} else {
				continue
			}
		}
		if k >= minPeriod && r[k] > maxVal {
			maxVal = r[k]
			peakLag = k
		}
	}
	if peakLag == 0 {
		return 0.0, 0 // No clear pitch period found (likely background noise)
	}
	f0 := float64(sampleRate) / float64(peakLag)
	return f0, peakLag
}

// SolveFourierSeries extracts N harmonic multipliers over exactly one pitch cycle (L samples)
func SolveFourierSeries(samples []float64, sampleRate int, harmonicsCount int) (*EquationCoefficients, error) {
	// Find pitch and period length
	f0, periodSamples := DetectPitchAutocorrelation(samples, sampleRate)
	if f0 < 40.0 || periodSamples <= 0 {
		// Fallback defaults to standard A4 (440Hz) if no periodic structure is detected
		f0 = 440.0
		periodSamples = sampleRate / 440
	}
	// Find the audio window with the highest energy to analyze the most representative segment
	bestStart := 0
	maxEnergy := 0.0
	for i := 0; i < len(samples)-periodSamples; i += periodSamples / 2 {
		energy := 0.0
		for j := 0; j < periodSamples; j++ {
			energy += samples[i+j] * samples[i+j]
		}
		if energy > maxEnergy {
			maxEnergy = energy
			bestStart = i
		}
	}
	// Slice exactly one period L
	cycleSamples := samples[bestStart : bestStart+periodSamples]
	L := float64(periodSamples)
	// 1. Calculate a_0 (DC offset / mean value)
	sumA0 := 0.0
	for _, x := range cycleSamples {
		sumA0 += x
	}
	a0 := (2.0 / L) * sumA0
	an := make([]float64, harmonicsCount)
	bn := make([]float64, harmonicsCount)
	// 2. Calculate a_n and b_n via discrete trigonometric integration
	for n := 1; n <= harmonicsCount; n++ {
		sumCos := 0.0
		sumSin := 0.0
		for i, x := range cycleSamples {
			// Phase angle theta = (2 * pi * n * i) / L
			theta := (2.0 * math.Pi * float64(n) * float64(i)) / L
			sumCos += x * math.Cos(theta)
			sumSin += x * math.Sin(theta)
		}
		an[n-1] = (2.0 / L) * sumCos
		bn[n-1] = (2.0 / L) * sumSin
	}
	return &EquationCoefficients{
		A0:                   a0,
		An:                   an,
		Bn:                   bn,
		FundamentalFrequency: f0,
	}, nil
}
