package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/vedansh-5/waveform/backend/internal/dsp"
)

func main() {
	files, err := filepath.Glob("uploads/*.wav")
	if err != nil {
		fmt.Printf("Glob error: %v\n", err)
		return
	}

	if len(files) == 0 {
		fmt.Println("No WAV files found in uploads/")
		return
	}

	for _, fPath := range files {
		file, err := os.Open(fPath)
		if err != nil {
			fmt.Printf("Failed to open %s: %v\n", fPath, err)
			continue
		}

		wave, err := dsp.ParseWAV(file)
		file.Close()
		if err != nil {
			fmt.Printf("Failed to parse WAV %s: %v\n", fPath, err)
			continue
		}

		f0, periodSamples := dsp.DetectPitchAutocorrelation(wave.Samples, wave.SampleRate)
		fmt.Printf("File: %s | Sample Rate: %d | Total Samples: %d\n", fPath, wave.SampleRate, len(wave.Samples))
		fmt.Printf("Detected Pitch: %.2f Hz | Period Samples: %d\n", f0, periodSamples)

		// Print first few samples to see if they are 0 or have real data
		nonZeroCount := 0
		maxVal := 0.0
		for _, s := range wave.Samples {
			if s != 0.0 {
				nonZeroCount++
			}
			if s > maxVal {
				maxVal = s
			}
		}
		fmt.Printf("Non-zero Samples: %d / %d | Max Amplitude: %.6f\n", nonZeroCount, len(wave.Samples), maxVal)

		coefs, err := dsp.SolveFourierSeries(wave.Samples, wave.SampleRate, 12)
		if err == nil {
			fmt.Printf("DC (A0): %.6f\n", coefs.A0)
			fmt.Printf("An[0..3]: %.6f, %.6f, %.6f, %.6f\n", coefs.An[0], coefs.An[1], coefs.An[2], coefs.An[3])
			fmt.Printf("Bn[0..3]: %.6f, %.6f, %.6f, %.6f\n", coefs.Bn[0], coefs.Bn[1], coefs.Bn[2], coefs.Bn[3])
		}
		fmt.Println("-------------------------------------------------------------")
	}
}
