'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Gauge } from 'lucide-react';



// Dynamic Waveform Classification & Textbook Formula Builder
function classifyWaveform(an: number[], bn: number[]): { name: string; formulaHTML: string } {
    const N = an.length;
    const C = an.map((a, i) => Math.sqrt(a * a + bn[i] * bn[i]));
    const totalE = C.reduce((sum, val) => sum + val * val, 0);

    if (totalE < 0.0001) {
        return {
            name: "Silence",
            formulaHTML: `<div class="flex items-center gap-1 font-serif text-zinc-500 text-lg sm:text-2xl italic select-none">y(t) = 0</div>`
        };
    }

    const fundEnergyRatio = (C[0] * C[0]) / totalE;

    let oddEnergy = 0;
    let evenEnergy = 0;
    for (let i = 0; i < N; i++) {
        if ((i + 1) % 2 === 1) {
            oddEnergy += C[i] * C[i];
        } else {
            evenEnergy += C[i] * C[i];
        }
    }
    const oddRatio = oddEnergy / totalE;
    const evenRatio = evenEnergy / totalE;

    // 1. Pure Sine (fundamental harmonic contains > 82% of energy)
    if (fundEnergyRatio > 0.82) {
        return {
            name: "Pure Sinusoidal Wave",
            formulaHTML: `
                <div class="flex items-center gap-1 font-serif text-white text-lg sm:text-2xl tracking-normal select-none">
                    <span class="italic text-zinc-400">y(t)</span>
                    <span class="mx-1.5 text-zinc-500">=</span>
                    <span class="font-mono text-zinc-200">${C[0].toFixed(3)}</span>
                    <span class="italic text-zinc-400 ml-1.5">sin</span>
                    <span class="text-zinc-500">(</span>
                    <span class="italic text-zinc-400 font-mono text-sm sm:text-lg">ω₀t</span>
                    <span class="text-zinc-500">)</span>
                </div>
            `
        };
    }

    // 2. Triangle Wave (odd harmonics dominant, decay very rapidly ~1/n^2)
    if (oddRatio > 0.85 && (C[2] / C[0] < 0.15)) {
        return {
            name: "Symmetric Triangle Wave",
            formulaHTML: `
                <div class="flex items-center gap-1 font-serif text-white text-lg sm:text-2xl tracking-normal select-none">
                    <span class="italic text-zinc-400 shrink-0">y(t)</span>
                    <span class="mx-1.5 text-zinc-500 shrink-0">=</span>
                    <div class="flex flex-col items-center mx-2 text-zinc-200 shrink-0">
                        <span class="border-b border-zinc-600 px-2 pb-0.5 text-center font-serif text-sm sm:text-lg">8A</span>
                        <span class="pt-0.5 text-center font-serif text-sm sm:text-lg">π²</span>
                    </div>
                    <div class="flex flex-col items-center mx-1 shrink-0">
                        <span class="text-[9px] font-mono text-zinc-500 mb-[-4px]">12</span>
                        <span class="text-2xl sm:text-4xl font-light leading-none text-violet-400 select-none">∑</span>
                        <span class="text-[9px] font-mono text-zinc-500 mt-[-2px]">k=0</span>
                    </div>
                    <div class="flex items-center gap-1 text-zinc-300 shrink-0 text-sm sm:text-lg">
                        <div class="flex flex-col items-center mx-1 text-zinc-300">
                            <span class="border-b border-zinc-600 px-1 pb-0.5 text-center font-serif text-xs">(-1)<sup>k</sup></span>
                            <span class="pt-0.5 text-center font-serif text-xs">(2k+1)<sup>2</sup></span>
                        </div>
                        <span class="italic text-zinc-400 ml-1">sin</span>
                        <span class="text-zinc-500">(</span>
                        <span class="italic text-zinc-400 text-xs sm:text-sm font-mono">(2k+1)ω₀t</span>
                        <span class="text-zinc-500">)</span>
                    </div>
                </div>
            `
        };
    }

    // 3. Square Wave (odd harmonics dominant, decay slowly ~1/n)
    if (oddRatio > 0.85) {
        return {
            name: "Symmetric Square Wave",
            formulaHTML: `
                <div class="flex items-center gap-1 font-serif text-white text-lg sm:text-2xl tracking-normal select-none">
                    <span class="italic text-zinc-400 shrink-0">y(t)</span>
                    <span class="mx-1.5 text-zinc-500 shrink-0">=</span>
                    <div class="flex flex-col items-center mx-2 text-zinc-200 shrink-0">
                        <span class="border-b border-zinc-600 px-2 pb-0.5 text-center font-serif text-sm sm:text-lg">4A</span>
                        <span class="pt-0.5 text-center font-serif text-sm sm:text-lg">π</span>
                    </div>
                    <div class="flex flex-col items-center mx-1 shrink-0">
                        <span class="text-[9px] font-mono text-zinc-500 mb-[-4px]">12</span>
                        <span class="text-2xl sm:text-4xl font-light leading-none text-violet-400 select-none">∑</span>
                        <span class="text-[9px] font-mono text-zinc-500 mt-[-2px]">k=0</span>
                    </div>
                    <div class="flex items-center gap-1 text-zinc-300 shrink-0 text-sm sm:text-lg">
                        <div class="flex flex-col items-center mx-1 text-zinc-300">
                            <span class="border-b border-zinc-600 px-1 pb-0.5 text-center font-serif text-xs">1</span>
                            <span class="pt-0.5 text-center font-serif text-xs">2k+1</span>
                        </div>
                        <span class="italic text-zinc-400 ml-1">sin</span>
                        <span class="text-zinc-500">(</span>
                        <span class="italic text-zinc-400 text-xs sm:text-sm font-mono">(2k+1)ω₀t</span>
                        <span class="text-zinc-500">)</span>
                    </div>
                </div>
            `
        };
    }

    // 4. Sawtooth Wave (even and odd harmonics are prominent)
    if (evenRatio > 0.20 && oddRatio > 0.35 && C[1] / C[0] > 0.25) {
        return {
            name: "Asymmetric Sawtooth Wave",
            formulaHTML: `
                <div class="flex items-center gap-1 font-serif text-white text-lg sm:text-2xl tracking-normal select-none">
                    <span class="italic text-zinc-400 shrink-0">y(t)</span>
                    <span class="mx-1.5 text-zinc-500 shrink-0">=</span>
                    <div class="flex flex-col items-center mx-2 text-zinc-200 shrink-0">
                        <span class="border-b border-zinc-600 px-2 pb-0.5 text-center font-serif text-sm sm:text-lg">2A</span>
                        <span class="pt-0.5 text-center font-serif text-sm sm:text-lg">π</span>
                    </div>
                    <div class="flex flex-col items-center mx-1 shrink-0">
                        <span class="text-[9px] font-mono text-zinc-500 mb-[-4px]">12</span>
                        <span class="text-2xl sm:text-4xl font-light leading-none text-violet-400 select-none">∑</span>
                        <span class="text-[9px] font-mono text-zinc-500 mt-[-2px]">n=1</span>
                    </div>
                    <div class="flex items-center gap-1 text-zinc-300 shrink-0 text-sm sm:text-lg">
                        <div class="flex flex-col items-center mx-1 text-zinc-300">
                            <span class="border-b border-zinc-600 px-1 pb-0.5 text-center font-serif text-xs">(-1)<sup>n+1</sup></span>
                            <span class="pt-0.5 text-center font-serif text-xs">n</span>
                        </div>
                        <span class="italic text-zinc-400 ml-1">sin</span>
                        <span class="text-zinc-500">(</span>
                        <span class="italic text-zinc-400 text-xs sm:text-sm font-mono">nω₀t</span>
                        <span class="text-zinc-500">)</span>
                    </div>
                </div>
            `
        };
    }

    // Default: General Fourier Series Summation
    return {
        name: "General Harmonic Waveform",
        formulaHTML: `
            <div class="flex items-center gap-1 font-serif text-white text-lg sm:text-2xl tracking-normal select-none">
                <span class="italic text-zinc-400 shrink-0">y(t)</span>
                <span class="mx-1.5 text-zinc-500 shrink-0">=</span>
                <div class="flex flex-col items-center mx-2 text-zinc-200 shrink-0">
                    <span class="border-b border-zinc-600 px-2 pb-0.5 text-center font-mono text-sm sm:text-lg" id="realtime-eq-dc-frac">a₀</span>
                    <span class="pt-0.5 text-center font-mono text-sm sm:text-lg">2</span>
                </div>
                <span class="mx-1 text-zinc-500 font-bold shrink-0">+</span>
                <div class="flex flex-col items-center mx-1 shrink-0">
                    <span class="text-[9px] font-mono text-zinc-500 mb-[-4px]">12</span>
                    <span class="text-2xl sm:text-4xl font-light leading-none text-violet-400 select-none">∑</span>
                    <span class="text-[9px] font-mono text-zinc-500 mt-[-2px]">n=1</span>
                </div>
                <div class="flex items-center gap-1 text-zinc-300 shrink-0 text-xs sm:text-lg">
                    <span class="text-xl text-zinc-500 font-light mr-0.5">(</span>
                    <span class="font-mono text-xs sm:text-sm text-fuchsia-400 font-bold">aₙ</span>
                    <span class="italic text-zinc-400 text-xs sm:text-base">cos</span>
                    <span class="text-zinc-500 text-xs sm:text-base">(</span>
                    <span class="italic text-zinc-400 text-[10px] sm:text-sm font-mono">nω₀t</span>
                    <span class="text-zinc-500 text-xs sm:text-base">)</span>
                    <span class="mx-0.5 text-zinc-500 font-bold">+</span>
                    <span class="font-mono text-xs sm:text-sm text-emerald-400 font-bold">bₙ</span>
                    <span class="italic text-zinc-400 text-xs sm:text-base">sin</span>
                    <span class="text-zinc-500 text-xs sm:text-base">(</span>
                    <span class="italic text-zinc-400 text-[10px] sm:text-sm font-mono">nω₀t</span>
                    <span class="text-zinc-500 text-xs sm:text-base">)</span>
                    <span class="text-xl text-zinc-500 font-light ml-0.5">)</span>
                </div>
            </div>
        `
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

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        timeRef.current = 0;
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

        // Setup Groups
        const axesGroup = svg.append('g');
        const waveGroup = svg.append('g');
        const epicyclesGroup = svg.append('g');

        // Setup Defs for Gradient and Marker
        const defs = svg.append('defs');
        
        const grad = defs.append('linearGradient')
            .attr('id', 'wave-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e');
        grad.append('stop').attr('offset', '100%').attr('stop-color', '#8b5cf6');

        defs.append('marker')
            .attr('id', 'arrow-end')
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 6)
            .attr('refY', 5)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto-start-reverse')
            .append('path')
            .attr('d', 'M 0 1.5 L 8 5 L 0 8.5 z')
            .attr('fill', 'rgba(255, 255, 255, 0.35)');

        // Draw static textbook coordinate axes
        const axesColor = 'rgba(255, 255, 255, 0.12)';
        const waveWidth = width - 40 - waveStartX;
        let revealProgress = 0;

        // t-axis (horizontal)
        axesGroup.append('line')
            .attr('x1', waveStartX - 15)
            .attr('y1', centerY)
            .attr('x2', width - 25)
            .attr('y2', centerY)
            .attr('stroke', axesColor)
            .attr('stroke-width', 1.2)
            .attr('marker-end', 'url(#arrow-end)');

        // y-axis (vertical)
        axesGroup.append('line')
            .attr('x1', waveStartX)
            .attr('y1', height - 25)
            .attr('x2', waveStartX)
            .attr('y2', 25)
            .attr('stroke', axesColor)
            .attr('stroke-width', 1.2)
            .attr('marker-end', 'url(#arrow-end)');

        // Axes labels (serif math italic)
        axesGroup.append('text')
            .attr('x', width - 20)
            .attr('y', centerY + 16)
            .attr('text-anchor', 'end')
            .attr('class', 'font-serif italic fill-zinc-500 text-[11px] sm:text-xs select-none')
            .text('t');

        axesGroup.append('text')
            .attr('x', waveStartX - 14)
            .attr('y', 23)
            .attr('class', 'font-serif italic fill-zinc-500 text-[11px] sm:text-xs select-none')
            .text('y');

        const lineGenerator = d3.line<{ x: number; y: number }>()
            .x((d) => d.x)
            .y((d) => d.y)
            .curve(d3.curveLinear);

        const drawLoop = () => {
            const time = timeRef.current;

            // Step 1: Resolve smooth real-time or static frequency & volume variables
            let a0_val = a0;
            let an_val = [...an];
            let bn_val = [...bn];
            let f0_val = fundamentalFrequency;



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

            // Real-time Wave Classification & Textbook Equation Layout Update
            const classification = classifyWaveform(an_val, bn_val);
            
            const classBadgeEl = document.getElementById('realtime-wave-classification');
            if (classBadgeEl) {
                classBadgeEl.innerText = classification.name;
            }

            const equationContainer = document.getElementById('textbook-equation-container');
            if (equationContainer) {
                equationContainer.innerHTML = classification.formulaHTML;
            }

            // Generate clean series expansion approximation:
            let approxString = `y(t) ≈ ${(a0_val / 2).toFixed(3)}`;
            let addedTermsCount = 0;
            for (let n = 1; n <= N; n++) {
                const a_n = an_val[n - 1];
                const b_n = bn_val[n - 1];
                if (Math.abs(a_n) > 0.005) {
                    approxString += ` ${a_n >= 0 ? '+' : '-'} ${Math.abs(a_n).toFixed(3)} cos(${n === 1 ? '' : n}ω₀t)`;
                    addedTermsCount++;
                }
                if (Math.abs(b_n) > 0.005) {
                    approxString += ` ${b_n >= 0 ? '+' : '-'} ${Math.abs(b_n).toFixed(3)} sin(${n === 1 ? '' : n}ω₀t)`;
                    addedTermsCount++;
                }
                if (addedTermsCount >= 4) {
                    approxString += " + ...";
                    break;
                }
            }
            if (addedTermsCount === 0) {
                approxString = `y(t) ≈ ${(a0_val / 2).toFixed(3)}`;
            }

            const approxEl = document.getElementById('math-eq-expanded-approx');
            if (approxEl) {
                approxEl.innerText = approxString;
            }

            // Tip dot
            epicyclesGroup.append('circle')
                .attr('cx', currentX)
                .attr('cy', currentY)
                .attr('r', 3)
                .attr('fill', '#f43f5e');

            // Connector line (horizontal to the start of the mathematical plot at waveStartX)
            epicyclesGroup.append('line')
                .attr('x1', currentX)
                .attr('y1', currentY)
                .attr('x2', waveStartX)
                .attr('y2', currentY)
                .attr('stroke', 'rgba(244, 63, 94, 0.25)')
                .attr('stroke-dasharray', '4,4')
                .attr('stroke-width', 1);

            // Pristine Mathematical Function Plotting evaluated using the current frame's coefficients
            waveGroup.selectAll('*').remove();
            
            const propagatedPoints: { x: number; y: number }[] = [];
            const sampleCount = 250;
            const spanAngle = 3 * 2 * Math.PI; // exactly 3 periods (6 * PI)

            for (let i = 0; i <= sampleCount; i++) {
                const fraction = i / sampleCount;
                
                // Only draw up to revealProgress
                if (fraction > revealProgress && revealProgress < 0.999) {
                    continue;
                }

                const x = waveStartX + fraction * waveWidth;
                
                // Animate wave moving to the right: subtract spatial phase from time
                const theta = time - fraction * spanAngle;
                
                let ySum = centerY + (a0_val * scaleFactor * 0.5);
                circles.forEach((circle) => {
                    ySum += circle.radius * Math.sin(circle.freq * theta + circle.phase);
                });
                
                propagatedPoints.push({ x, y: ySum });
            }

            // Render scrolling wave mathematically with linear interpolation to maintain sharp geometric shapes
            if (propagatedPoints.length > 1) {
                waveGroup.append('path')
                    .datum(propagatedPoints)
                    .attr('fill', 'none')
                    .attr('stroke', 'url(#wave-gradient)')
                    .attr('stroke-width', 2.5)
                    .attr('d', lineGenerator);
            }

            // Probe dot on the moving curve at waveStartX
            if (propagatedPoints.length > 0) {
                waveGroup.append('circle')
                    .attr('cx', propagatedPoints[0].x)
                    .attr('cy', propagatedPoints[0].y)
                    .attr('r', 4)
                    .attr('fill', '#f43f5e')
                    .attr('class', 'animate-pulse');
            }

            if (isPlayingRef.current) {
                const pitchRatio = fundamentalFrequency > 0 ? (f0_val / fundamentalFrequency) : 1.0;
                const clampedRatio = Math.max(0.2, Math.min(5.0, pitchRatio));
                timeRef.current += 0.02 * speedMultiplier * clampedRatio;
                // Increment reveal progress smoothly
                revealProgress = Math.min(1.0, revealProgress + 0.0035 * speedMultiplier * clampedRatio);
            }
            animationRef.current = requestAnimationFrame(drawLoop);
        };

        drawLoop();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [a0, an, bn, fundamentalFrequency, resetSignal, speedMultiplier, dimensions, audioRef]);

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