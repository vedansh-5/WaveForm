'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Gauge } from 'lucide-react';

// Real-Time Javascript-based Pitch Autocorrelation Tracker
function detectPitchAutocorrelationInJS(samples: Float32Array, sampleRate: number) {
    const n = samples.length;
    if (n === 0) return { f0: 0, periodSamples: 0 };
    
    // Restrict frequency searching area to typical human pitch bounds: 80Hz - 1000Hz
    const minPeriod = Math.floor(sampleRate / 1000);
    const maxPeriod = Math.floor(sampleRate / 80);
    const limit = Math.min(maxPeriod, n - 1);
    
    const r = new Float64Array(limit + 1);
    // Compute autocorrelation coefficients: R(k) = sum(x[t] * x[t+k])
    for (let k = 0; k <= limit; k++) {
        let sum = 0;
        for (let t = 0; t < n - k; t++) {
            sum += samples[t] * samples[t + k];
        }
        r[k] = sum;
    }
    
    // Find the peak of correlation past the initial zero-lag decay
    let peakLag = 0;
    let maxVal = -1.0;
    let decayPhase = true;
    for (let k = 1; k <= limit; k++) {
        if (decayPhase) {
            if (r[k] > r[k - 1]) {
                decayPhase = false;
            } else {
                continue;
            }
        }
        if (k >= minPeriod && r[k] > maxVal) {
            maxVal = r[k];
            peakLag = k;
        }
    }
    
    if (peakLag === 0) {
        return { f0: 0, periodSamples: 0 };
    }
    const f0 = sampleRate / peakLag;
    return { f0, periodSamples: peakLag };
}

// Real-Time 12-Harmonic Discrete Fourier Integrator
function solveFourierSeriesInJS(
    samples: Float32Array,
    sampleRate: number,
    harmonicsCount: number
) {
    const { f0, periodSamples } = detectPitchAutocorrelationInJS(samples, sampleRate);
    
    if (f0 < 40 || periodSamples <= 0 || periodSamples > samples.length) {
        return null;
    }
    
    // Find the first zero-crossing with positive slope for phase stability
    let startIndex = 0;
    for (let i = 0; i < samples.length - 1 - periodSamples; i++) {
        if (samples[i] < 0 && samples[i + 1] >= 0) {
            startIndex = i;
            break;
        }
    }
    
    const L = periodSamples;
    let sumA0 = 0;
    for (let i = 0; i < L; i++) {
        sumA0 += samples[startIndex + i];
    }
    const a0 = (2.0 / L) * sumA0;
    
    const an = new Float64Array(harmonicsCount);
    const bn = new Float64Array(harmonicsCount);
    
    for (let n = 1; n <= harmonicsCount; n++) {
        let sumCos = 0;
        let sumSin = 0;
        for (let i = 0; i < L; i++) {
            const theta = (2.0 * Math.PI * n * i) / L;
            const x = samples[startIndex + i];
            sumCos += x * Math.cos(theta);
            sumSin += x * Math.sin(theta);
        }
        an[n - 1] = (2.0 / L) * sumCos;
        bn[n - 1] = (2.0 / L) * sumSin;
    }
    
    return {
        a0,
        an: Array.from(an),
        bn: Array.from(bn),
        f0
    };
}

interface VisualizerProps {
    a0: number;
    an: number[];
    bn: number[];
    fundamentalFrequency: number;
    isPlaying: boolean;
    resetSignal: number;
    speedMultiplier: number;
    setSpeedMultiplier: (speed: number) => void;
    audioRef?: React.RefObject<HTMLAudioElement | null>;
}

export default function MathFourierVisualizer({
    a0,
    an,
    bn,
    fundamentalFrequency,
    isPlaying,
    resetSignal,
    speedMultiplier,
    setSpeedMultiplier,
    audioRef
}: VisualizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
    const animationRef = useRef<number | null>(null);

    const isPlayingRef = useRef(isPlaying);
    const timeRef = useRef(0);
    const wavePointsRef = useRef<{ x: number; y: number }[]>([]);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        timeRef.current = 0;
        wavePointsRef.current = [];
    }, [resetSignal]);

    // Responsive resize observer
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w = entry.contentRect.width;
                const h = Math.max(280, Math.min(420, w * 0.55));
                setDimensions({ width: Math.floor(w), height: Math.floor(h) });
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const buildVisualization = useCallback(() => {
        if (!containerRef.current) return;
        d3.select(containerRef.current).selectAll('*').remove();

        const { width, height } = dimensions;
        const isMobile = width < 500;
        const centerX = isMobile ? width * 0.4 : width * 0.3;
        const centerY = height / 2;
        const waveStartX = isMobile ? width * 0.65 : centerX + 180;

        const svg = d3.select(containerRef.current)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('class', 'overflow-visible');

        const epicyclesGroup = svg.append('g');
        const waveGroup = svg.append('g');

        const waveHistoryLimit = Math.floor(width * 0.5);

        const lineGenerator = d3.line<{ x: number; y: number }>()
            .x((d) => d.x)
            .y((d) => d.y)
            .curve(d3.curveBasisOpen);

        const drawLoop = () => {
            const time = timeRef.current;
            const wavePoints = wavePointsRef.current;

            // Step 1: Resolve smooth real-time or static frequency & volume variables
            let a0_val = a0;
            let an_val = [...an];
            let bn_val = [...bn];
            let f0_val = fundamentalFrequency;

            if (isPlayingRef.current && audioRef?.current) {
                const audioEl = audioRef.current;
                let analyser = (audioEl as any)._audioAnalyser as AnalyserNode | undefined;
                if (!analyser) {
                    try {
                        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                        const audioCtx = new AudioContextClass();
                        analyser = audioCtx.createAnalyser();
                        analyser.fftSize = 2048;
                        
                        const source = audioCtx.createMediaElementSource(audioEl);
                        source.connect(analyser);
                        analyser.connect(audioCtx.destination);
                        
                        (audioEl as any)._audioContext = audioCtx;
                        (audioEl as any)._audioSourceNode = source;
                        (audioEl as any)._audioAnalyser = analyser;
                    } catch (e) {
                        console.error("Error setting up audio analyser:", e);
                    }
                }

                if (analyser) {
                    const audioCtx = (audioEl as any)._audioContext as AudioContext;
                    if (audioCtx && audioCtx.state === 'suspended') {
                        audioCtx.resume();
                    }

                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Float32Array(bufferLength);
                    analyser.getFloatTimeDomainData(dataArray);

                    // Compute RMS energy (volume)
                    let rms = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        rms += dataArray[i] * dataArray[i];
                    }
                    rms = Math.sqrt(rms / bufferLength);

                    // Track smooth RMS
                    if ((audioEl as any)._smoothRMS === undefined) {
                        (audioEl as any)._smoothRMS = rms;
                    } else {
                        (audioEl as any)._smoothRMS = (audioEl as any)._smoothRMS * 0.8 + rms * 0.2;
                    }

                    const smoothVolume = (audioEl as any)._smoothRMS || 0;

                    if (smoothVolume > 0.005) {
                        const result = solveFourierSeriesInJS(dataArray, audioCtx.sampleRate, an.length);
                        if (result) {
                            // Apply smooth exponential moving average to coefficients and frequency
                            if ((audioEl as any)._prevA0 === undefined) {
                                (audioEl as any)._prevA0 = result.a0;
                                (audioEl as any)._prevAn = result.an;
                                (audioEl as any)._prevBn = result.bn;
                                (audioEl as any)._prevF0 = result.f0;
                            } else {
                                const beta = 0.25; // smoothing factor to balance responsiveness and stability
                                (audioEl as any)._prevA0 = (audioEl as any)._prevA0 * (1 - beta) + result.a0 * beta;
                                (audioEl as any)._prevF0 = (audioEl as any)._prevF0 * (1 - beta) + result.f0 * beta;
                                for (let i = 0; i < an.length; i++) {
                                    (audioEl as any)._prevAn[i] = (audioEl as any)._prevAn[i] * (1 - beta) + result.an[i] * beta;
                                    (audioEl as any)._prevBn[i] = (audioEl as any)._prevBn[i] * (1 - beta) + result.bn[i] * beta;
                                }
                            }
                            
                            a0_val = (audioEl as any)._prevA0;
                            an_val = [...(audioEl as any)._prevAn];
                            bn_val = [...(audioEl as any)._prevBn];
                            f0_val = (audioEl as any)._prevF0;
                        } else {
                            // If pitch detection fails (e.g. noise/transients), scale the static coefficients by volume as a fallback
                            const volumeScale = Math.min(2.0, Math.max(0.15, smoothVolume / 0.12));
                            a0_val = a0 * volumeScale;
                            an_val = an.map(v => v * volumeScale);
                            bn_val = bn.map(v => v * volumeScale);
                        }
                    } else {
                        // Silent: collapse circles to zero and flatten wave to a straight line
                        a0_val = 0;
                        an_val = an.map(() => 0);
                        bn_val = bn.map(() => 0);
                        f0_val = 0;
                    }
                }
            } else if (!isPlayingRef.current && audioRef?.current) {
                // Reset smooth history when paused or stopped
                const audioEl = audioRef.current;
                (audioEl as any)._smoothF0 = undefined;
                (audioEl as any)._smoothRMS = undefined;
                (audioEl as any)._prevA0 = undefined;
                (audioEl as any)._prevAn = undefined;
                (audioEl as any)._prevBn = undefined;
                (audioEl as any)._prevF0 = undefined;
            }

            // Step 2: Build harmonic circle descriptors based on computed clean coefficients
            const circles: { radius: number; freq: number; phase: number }[] = [];
            const N = an_val.length;
            const maxAmplitude = Math.max(...an_val.map(Math.abs), ...bn_val.map(Math.abs), 0.01);
            const maxRadius = isMobile ? 50 : 80;
            const scaleFactor = maxRadius / maxAmplitude;

            for (let i = 0; i < N; i++) {
                const n = i + 1;
                const a = an_val[i] * scaleFactor;
                const b = bn_val[i] * scaleFactor;
                const radius = Math.sqrt(a * a + b * b);
                const phase = Math.atan2(b, a);
                if (radius > 0.5) {
                    circles.push({ radius, freq: n, phase });
                }
            }
            circles.sort((a, b) => b.radius - a.radius);

            // Step 3: Draw D3 epicycles
            let currentX = centerX;
            let currentY = centerY + (a0_val * scaleFactor * 0.5);
            epicyclesGroup.selectAll('*').remove();

            let xtVal = a0_val / 2;

            // Dynamically update fundamental frequency labels in DOM
            const f0El = document.getElementById('realtime-f0-val');
            if (f0El) {
                f0El.innerText = `${f0_val.toFixed(1)} Hz`;
            }
            const f0EqEl = document.getElementById('realtime-f0-eq-val');
            if (f0EqEl) {
                f0EqEl.innerText = f0_val.toFixed(1);
            }

            // Dynamically update DC Offset constant term in DOM
            const dcEl = document.getElementById('realtime-dc-val');
            if (dcEl) {
                dcEl.innerText = (a0_val / 2).toFixed(6);
            }
            const eqDcEl = document.getElementById('realtime-eq-dc');
            if (eqDcEl) {
                eqDcEl.innerText = (a0_val / 2).toFixed(4);
            }

            // Dynamically update the header mathematical equation's first 2 harmonics
            for (let n = 1; n <= 2; n++) {
                const a_n_val = an_val[n - 1] || 0;
                const b_n_val = bn_val[n - 1] || 0;
                const eqCosEl = document.getElementById(`realtime-eq-cos-${n}`);
                if (eqCosEl) {
                    eqCosEl.innerText = `(${a_n_val >= 0 ? '+' : ''}${a_n_val.toFixed(4)})`;
                }
                const eqSinEl = document.getElementById(`realtime-eq-sin-${n}`);
                if (eqSinEl) {
                    eqSinEl.innerText = `(${b_n_val >= 0 ? '+' : ''}${b_n_val.toFixed(4)})`;
                }
            }

            circles.forEach((circle, idx) => {
                const prevX = currentX;
                const prevY = currentY;
                const angle = circle.freq * time + circle.phase;
                currentX += circle.radius * Math.cos(angle);
                currentY += circle.radius * Math.sin(angle);

                const n = circle.freq;
                const a_n_val = an_val[n - 1] || 0;
                const b_n_val = bn_val[n - 1] || 0;
                const cosTerm = a_n_val * Math.cos(n * time);
                const sinTerm = b_n_val * Math.sin(n * time);
                xtVal += cosTerm + sinTerm;

                // Update individual dynamic evaluation elements in the DOM
                const cosEl = document.getElementById(`realtime-cos-val-${n}`);
                if (cosEl) {
                    cosEl.innerText = (cosTerm >= 0 ? '+' : '') + cosTerm.toFixed(6);
                }
                const cosEqEl = document.getElementById(`realtime-cos-val-eq-${n}`);
                if (cosEqEl) {
                    cosEqEl.innerText = (cosTerm >= 0 ? '+' : '') + cosTerm.toFixed(6);
                }
                const sinEl = document.getElementById(`realtime-sin-val-${n}`);
                if (sinEl) {
                    sinEl.innerText = (sinTerm >= 0 ? '+' : '') + sinTerm.toFixed(6);
                }
                const sinEqEl = document.getElementById(`realtime-sin-val-eq-${n}`);
                if (sinEqEl) {
                    sinEqEl.innerText = (sinTerm >= 0 ? '+' : '') + sinTerm.toFixed(6);
                }

                // Update dynamic coefficient constant values in DOM
                const cosCoeffEqEl = document.getElementById(`realtime-cos-coeff-eq-${n}`);
                if (cosCoeffEqEl) {
                    cosCoeffEqEl.innerText = `(${a_n_val.toFixed(4)})`;
                }
                const sinCoeffEqEl = document.getElementById(`realtime-sin-coeff-eq-${n}`);
                if (sinCoeffEqEl) {
                    sinCoeffEqEl.innerText = `(${b_n_val.toFixed(4)})`;
                }
                const cosCoeffEl = document.getElementById(`realtime-cos-coeff-${n}`);
                if (cosCoeffEl) {
                    cosCoeffEl.innerText = `(${a_n_val >= 0 ? '+' : ''}${a_n_val.toFixed(4)})`;
                }
                const sinCoeffEl = document.getElementById(`realtime-sin-coeff-${n}`);
                if (sinCoeffEl) {
                    sinCoeffEl.innerText = `(${b_n_val >= 0 ? '+' : ''}${b_n_val.toFixed(4)})`;
                }

                // Orbit ring
                epicyclesGroup.append('circle')
                    .attr('cx', prevX)
                    .attr('cy', prevY)
                    .attr('r', circle.radius)
                    .attr('fill', 'none')
                    .attr('stroke', `rgba(139, 92, 246, ${0.06 + idx * 0.01})`)
                    .attr('stroke-width', 1);

                // Radius vector
                epicyclesGroup.append('line')
                    .attr('x1', prevX)
                    .attr('y1', prevY)
                    .attr('x2', currentX)
                    .attr('y2', currentY)
                    .attr('stroke', `rgba(167, 139, 250, ${0.5 + idx * 0.03})`)
                    .attr('stroke-width', 1.5);
            });

            // Update main dynamic equations elements in the DOM
            const xtEl = document.getElementById('realtime-x-val');
            if (xtEl) {
                xtEl.innerText = (xtVal >= 0 ? '+' : '') + xtVal.toFixed(6);
            }
            const tEl = document.getElementById('realtime-t-val');
            if (tEl) {
                tEl.innerText = time.toFixed(2);
            }

            // Tip dot
            epicyclesGroup.append('circle')
                .attr('cx', currentX)
                .attr('cy', currentY)
                .attr('r', 3)
                .attr('fill', '#f43f5e');

            // Freeze the wave trace in place when paused to completely prevent flat segments
            if (isPlayingRef.current || wavePoints.length === 0) {
                wavePoints.unshift({ x: waveStartX, y: currentY });
                if (wavePoints.length > waveHistoryLimit) {
                    wavePoints.pop();
                }
            }

            // Connector line
            epicyclesGroup.append('line')
                .attr('x1', currentX)
                .attr('y1', currentY)
                .attr('x2', waveStartX)
                .attr('y2', currentY)
                .attr('stroke', 'rgba(244, 63, 94, 0.25)')
                .attr('stroke-dasharray', '4,4')
                .attr('stroke-width', 1);

            // Wave trace
            waveGroup.selectAll('*').remove();
            const propagatedPoints = wavePoints.map((pt, idx) => ({
                x: pt.x + idx * (isMobile ? 0.6 : 1.0),
                y: pt.y,
            }));

            if (propagatedPoints.length > 2) {
                waveGroup.append('path')
                    .datum(propagatedPoints)
                    .attr('fill', 'none')
                    .attr('stroke', 'url(#wave-gradient)')
                    .attr('stroke-width', 2.5)
                    .attr('d', lineGenerator);
            }

            // Probe dot
            if (propagatedPoints.length > 0) {
                waveGroup.append('circle')
                    .attr('cx', propagatedPoints[0].x)
                    .attr('cy', propagatedPoints[0].y)
                    .attr('r', 4)
                    .attr('fill', '#f43f5e')
                    .attr('class', 'animate-pulse');
            }

            if (isPlayingRef.current) {
                // Dynamically scale time step by real-time pitch ratio for perfect visual speed syncing
                const pitchRatio = fundamentalFrequency > 0 ? (f0_val / fundamentalFrequency) : 1.0;
                const clampedRatio = Math.max(0.2, Math.min(5.0, pitchRatio));
                timeRef.current += 0.02 * speedMultiplier * clampedRatio;
            }
            animationRef.current = requestAnimationFrame(drawLoop);
        };

        // Gradient definition
        const defs = svg.append('defs');
        const grad = defs.append('linearGradient')
            .attr('id', 'wave-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e');
        grad.append('stop').attr('offset', '100%').attr('stop-color', '#8b5cf6');

        drawLoop();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [a0, an, bn, fundamentalFrequency, speedMultiplier, dimensions, audioRef]);

    useEffect(() => {
        const cleanup = buildVisualization();
        return cleanup;
    }, [buildVisualization]);

    return (
        <div className="rounded-2xl glass-panel overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Fourier Series Epicycles</h3>
                    <p className="text-[11px] text-zinc-500 mt-1 font-mono">
                        f₀ = <span id="realtime-f0-val" className="text-violet-400">{fundamentalFrequency.toFixed(1)} Hz</span>
                    </p>
                </div>

                {/* Speed Controls */}
                <div className="flex items-center gap-2">
                    <Gauge className="h-3.5 w-3.5 text-zinc-600" />
                    <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 font-bold">Speed</span>
                    {[0.5, 1.0, 2.0].map((speed) => (
                        <button
                            key={speed}
                            onClick={() => setSpeedMultiplier(speed)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                                speedMultiplier === speed
                                    ? 'border-violet-500/30 bg-violet-600/15 text-violet-300 shadow-sm shadow-violet-500/10'
                                    : 'border-white/[0.06] bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-white/[0.1]'
                            }`}
                        >
                            {speed}×
                        </button>
                    ))}
                </div>
            </div>

            {/* SVG Canvas */}
            <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                <div
                    ref={containerRef}
                    className="w-full rounded-xl border border-white/[0.04] bg-[#08080c] relative overflow-hidden"
                    style={{ minHeight: 280 }}
                />
            </div>
        </div>
    );
}