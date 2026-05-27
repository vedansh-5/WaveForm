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
            name: 'Silence',
            formulaHTML: `<div class="flex items-center gap-1 font-serif italic text-gray-400 text-lg sm:text-2xl select-none">y(t) = 0</div>`
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

    // Pure Sine
    if (fundEnergyRatio > 0.82) {
        return {
            name: 'Pure Sinusoidal Wave',
            formulaHTML: `
                <div class="flex items-center gap-1 font-serif text-lg sm:text-2xl tracking-normal select-none">
                    <span class="italic text-gray-400">y(t)</span>
                    <span class="mx-1.5 text-gray-500">=</span>
                    <span class="font-mono text-gray-200">${C[0].toFixed(3)}</span>
                    <span class="italic text-gray-400 ml-1.5">sin</span>
                    <span class="text-gray-500">(</span>
                    <span class="italic text-gray-400 font-mono text-sm sm:text-lg">&omega;<sub>0</sub>t</span>
                    <span class="text-gray-500">)</span>
                </div>
            `
        };
    }

    // Triangle Wave
    if (oddRatio > 0.85 && (C[2] / C[0] < 0.15)) {
        return {
            name: 'Symmetric Triangle Wave',
            formulaHTML: `
                <div class="flex items-center gap-1 font-serif text-lg sm:text-2xl tracking-normal select-none">
                    <span class="italic text-gray-400 shrink-0">y(t)</span>
                    <span class="mx-1.5 text-gray-500 shrink-0">=</span>
                    <div class="flex flex-col items-center mx-2 text-gray-200 shrink-0">
                        <span class="border-b border-gray-600 px-2 pb-0.5 text-center font-serif text-sm sm:text-lg">8A</span>
                        <span class="pt-0.5 text-center font-serif text-sm sm:text-lg">&pi;&sup2;</span>
                    </div>
                    <div class="flex flex-col items-center mx-1 shrink-0">
                        <span class="text-[9px] font-mono text-gray-500 mb-[-4px]">12</span>
                        <span class="text-2xl sm:text-4xl font-light leading-none text-[var(--accent)] select-none">&sum;</span>
                        <span class="text-[9px] font-mono text-gray-500 mt-[-2px]">k=0</span>
                    </div>
                    <div class="flex items-center gap-1 text-gray-300 shrink-0 text-sm sm:text-lg">
                        <div class="flex flex-col items-center mx-1 text-gray-300">
                            <span class="border-b border-gray-600 px-1 pb-0.5 text-center font-serif text-xs">(-1)<sup>k</sup></span>
                            <span class="pt-0.5 text-center font-serif text-xs">(2k+1)<sup>2</sup></span>
                        </div>
                        <span class="italic text-gray-400 ml-1">sin</span>
                        <span class="text-gray-500">(</span>
                        <span class="italic text-gray-400 text-xs sm:text-sm font-mono">(2k+1)&omega;<sub>0</sub>t</span>
                        <span class="text-gray-500">)</span>
                    </div>
                </div>
            `
        };
    }

    // Square Wave
    if (oddRatio > 0.85) {
        return {
            name: 'Symmetric Square Wave',
            formulaHTML: `
                <div class="flex items-center gap-1 font-serif text-lg sm:text-2xl tracking-normal select-none">
                    <span class="italic text-gray-400 shrink-0">y(t)</span>
                    <span class="mx-1.5 text-gray-500 shrink-0">=</span>
                    <div class="flex flex-col items-center mx-2 text-gray-200 shrink-0">
                        <span class="border-b border-gray-600 px-2 pb-0.5 text-center font-serif text-sm sm:text-lg">4A</span>
                        <span class="pt-0.5 text-center font-serif text-sm sm:text-lg">&pi;</span>
                    </div>
                    <div class="flex flex-col items-center mx-1 shrink-0">
                        <span class="text-[9px] font-mono text-gray-500 mb-[-4px]">12</span>
                        <span class="text-2xl sm:text-4xl font-light leading-none text-[var(--accent)] select-none">&sum;</span>
                        <span class="text-[9px] font-mono text-gray-500 mt-[-2px]">k=0</span>
                    </div>
                    <div class="flex items-center gap-1 text-gray-300 shrink-0 text-sm sm:text-lg">
                        <div class="flex flex-col items-center mx-1 text-gray-300">
                            <span class="border-b border-gray-600 px-1 pb-0.5 text-center font-serif text-xs">1</span>
                            <span class="pt-0.5 text-center font-serif text-xs">2k+1</span>
                        </div>
                        <span class="italic text-gray-400 ml-1">sin</span>
                        <span class="text-gray-500">(</span>
                        <span class="italic text-gray-400 text-xs sm:text-sm font-mono">(2k+1)&omega;<sub>0</sub>t</span>
                        <span class="text-gray-500">)</span>
                    </div>
                </div>
            `
        };
    }

    // Sawtooth Wave
    if (evenRatio > 0.20 && oddRatio > 0.35 && C[1] / C[0] > 0.25) {
        return {
            name: 'Asymmetric Sawtooth Wave',
            formulaHTML: `
                <div class="flex items-center gap-1 font-serif text-lg sm:text-2xl tracking-normal select-none">
                    <span class="italic text-gray-400 shrink-0">y(t)</span>
                    <span class="mx-1.5 text-gray-500 shrink-0">=</span>
                    <div class="flex flex-col items-center mx-2 text-gray-200 shrink-0">
                        <span class="border-b border-gray-600 px-2 pb-0.5 text-center font-serif text-sm sm:text-lg">2A</span>
                        <span class="pt-0.5 text-center font-serif text-sm sm:text-lg">&pi;</span>
                    </div>
                    <div class="flex flex-col items-center mx-1 shrink-0">
                        <span class="text-[9px] font-mono text-gray-500 mb-[-4px]">12</span>
                        <span class="text-2xl sm:text-4xl font-light leading-none text-[var(--accent)] select-none">&sum;</span>
                        <span class="text-[9px] font-mono text-gray-500 mt-[-2px]">n=1</span>
                    </div>
                    <div class="flex items-center gap-1 text-gray-300 shrink-0 text-sm sm:text-lg">
                        <div class="flex flex-col items-center mx-1 text-gray-300">
                            <span class="border-b border-gray-600 px-1 pb-0.5 text-center font-serif text-xs">(-1)<sup>n+1</sup></span>
                            <span class="pt-0.5 text-center font-serif text-xs">n</span>
                        </div>
                        <span class="italic text-gray-400 ml-1">sin</span>
                        <span class="text-gray-500">(</span>
                        <span class="italic text-gray-400 text-xs sm:text-sm font-mono">n&omega;<sub>0</sub>t</span>
                        <span class="text-gray-500">)</span>
                    </div>
                </div>
            `
        };
    }

    // Default: General Fourier Series
    return {
        name: 'General Harmonic Waveform',
        formulaHTML: `
            <div class="flex items-center gap-1 font-serif text-lg sm:text-2xl tracking-normal select-none">
                <span class="italic text-gray-400 shrink-0">y(t)</span>
                <span class="mx-1 text-gray-500 shrink-0">=</span>
                <div class="flex flex-col items-center mx-2 text-gray-200 shrink-0">
                    <span class="border-b border-gray-600 px-2 pb-0.5 text-center font-mono text-sm sm:text-lg" id="realtime-eq-dc-frac">a<sub>0</sub></span>
                    <span class="pt-0.5 text-center font-mono text-sm sm:text-lg">2</span>
                </div>
                <span class="mx-1 text-gray-500 font-bold shrink-0">+</span>
                <div class="flex flex-col items-center mx-1 shrink-0">
                    <span class="text-[9px] font-mono text-gray-500 mb-[-4px]">12</span>
                    <span class="text-2xl sm:text-4xl font-light leading-none text-[var(--accent)] select-none">&sum;</span>
                    <span class="text-[9px] font-mono text-gray-500 mt-[-2px]">n=1</span>
                </div>
                <div class="flex items-center gap-1 text-gray-300 shrink-0 text-xs sm:text-lg">
                    <span class="text-xl text-gray-500 font-light mr-0.5">(</span>
                    <span class="font-mono text-xs sm:text-sm text-[var(--accent)] font-bold">a<sub>n</sub></span>
                    <span class="italic text-gray-400 text-xs sm:text-base">cos</span>
                    <span class="text-gray-500 text-xs sm:text-base">(</span>
                    <span class="italic text-gray-400 text-[10px] sm:text-sm font-mono">n&omega;<sub>0</sub>t</span>
                    <span class="text-gray-500 text-xs sm:text-base">)</span>
                    <span class="mx-0.5 text-gray-500 font-bold">+</span>
                    <span class="font-mono text-xs sm:text-sm text-emerald-400 font-bold">b<sub>n</sub></span>
                    <span class="italic text-gray-400 text-xs sm:text-base">sin</span>
                    <span class="text-gray-500 text-xs sm:text-base">(</span>
                    <span class="italic text-gray-400 text-[10px] sm:text-sm font-mono">n&omega;<sub>0</sub>t</span>
                    <span class="text-gray-500 text-xs sm:text-base">)</span>
                    <span class="text-xl text-gray-500 font-light ml-0.5">)</span>
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
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4');
        grad.append('stop').attr('offset', '100%').attr('stop-color', '#22d3ee');

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
            .attr('fill', 'rgba(255, 255, 255, 0.25)');

        // Draw static textbook coordinate axes
        const axesColor = 'rgba(128, 128, 128, 0.2)';
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

        // Axes labels
        axesGroup.append('text')
            .attr('x', width - 20)
            .attr('y', centerY + 16)
            .attr('text-anchor', 'end')
            .attr('class', 'font-serif italic fill-gray-500 text-[11px] sm:text-xs select-none')
            .text('t');

        axesGroup.append('text')
            .attr('x', waveStartX - 14)
            .attr('y', 23)
            .attr('class', 'font-serif italic fill-gray-500 text-[11px] sm:text-xs select-none')
            .text('y');

        const lineGenerator = d3.line<{ x: number; y: number }>()
            .x((d) => d.x)
            .y((d) => d.y)
            .curve(d3.curveCatmullRom.alpha(0.5));

        const drawLoop = () => {
            const time = timeRef.current;

            const a0_val = a0;
            const an_val = [...an];
            const bn_val = [...bn];
            const f0_val = fundamentalFrequency;

            // Build harmonic circle descriptors
            const circles: { radius: number; freq: number; phase: number }[] = [];
            const N = an_val.length;
            const maxAmplitude = Math.max(...an_val.map(Math.abs), ...bn_val.map(Math.abs), 0.01);
            // Scale so the biggest circle fits in ~35% of the epicycle area width
            const epicycleAreaW = waveStartX - 20;
            const maxRadius = Math.min(epicycleAreaW * 0.35, isMobile ? 55 : 85);
            const scaleFactor = maxRadius / maxAmplitude;

            for (let i = 0; i < N; i++) {
                const n = i + 1;
                const a = an_val[i] * scaleFactor;
                const b = bn_val[i] * scaleFactor;
                const radius = Math.sqrt(a * a + b * b);
                const phase = Math.atan2(b, a);
                if (radius > 0.5) circles.push({ radius, freq: n, phase });
            }
            circles.sort((a, b) => b.radius - a.radius);

            // ── Clear both groups every frame (BUG FIX: was never clearing waveGroup) ──
            epicyclesGroup.selectAll('*').remove();
            waveGroup.selectAll('*').remove();

            // Epicycle tip position
            let currentX = centerX;
            let currentY = centerY;
            let xtVal = a0_val / 2;

            // Update DOM elements
            const f0El = document.getElementById('realtime-f0-val');
            if (f0El) f0El.innerText = `${f0_val.toFixed(1)} Hz`;
            const f0EqEl = document.getElementById('realtime-f0-eq-val');
            if (f0EqEl) f0EqEl.innerText = f0_val.toFixed(1);
            const dcEl = document.getElementById('realtime-dc-val');
            if (dcEl) dcEl.innerText = (a0_val / 2).toFixed(6);

            for (let n = 1; n <= 2; n++) {
                const a_n_val = an_val[n - 1] || 0;
                const b_n_val = bn_val[n - 1] || 0;
                const eqCosEl = document.getElementById(`realtime-eq-cos-${n}`);
                if (eqCosEl) eqCosEl.innerText = `(${a_n_val >= 0 ? '+' : ''}${a_n_val.toFixed(4)})`;
                const eqSinEl = document.getElementById(`realtime-eq-sin-${n}`);
                if (eqSinEl) eqSinEl.innerText = `(${b_n_val >= 0 ? '+' : ''}${b_n_val.toFixed(4)})`;
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

                const cosEl = document.getElementById(`realtime-cos-val-${n}`);
                if (cosEl) cosEl.innerText = (cosTerm >= 0 ? '+' : '') + cosTerm.toFixed(6);
                const cosEqEl = document.getElementById(`realtime-cos-val-eq-${n}`);
                if (cosEqEl) cosEqEl.innerText = (cosTerm >= 0 ? '+' : '') + cosTerm.toFixed(6);
                const sinEl = document.getElementById(`realtime-sin-val-${n}`);
                if (sinEl) sinEl.innerText = (sinTerm >= 0 ? '+' : '') + sinTerm.toFixed(6);
                const sinEqEl = document.getElementById(`realtime-sin-val-eq-${n}`);
                if (sinEqEl) sinEqEl.innerText = (sinTerm >= 0 ? '+' : '') + sinTerm.toFixed(6);

                const cosCoeffEqEl = document.getElementById(`realtime-cos-coeff-eq-${n}`);
                if (cosCoeffEqEl) cosCoeffEqEl.innerText = `(${a_n_val.toFixed(4)})`;
                const sinCoeffEqEl = document.getElementById(`realtime-sin-coeff-eq-${n}`);
                if (sinCoeffEqEl) sinCoeffEqEl.innerText = `(${b_n_val.toFixed(4)})`;
                const cosCoeffEl = document.getElementById(`realtime-cos-coeff-${n}`);
                if (cosCoeffEl) cosCoeffEl.innerText = `(${a_n_val >= 0 ? '+' : ''}${a_n_val.toFixed(4)})`;
                const sinCoeffEl = document.getElementById(`realtime-sin-coeff-${n}`);
                if (sinCoeffEl) sinCoeffEl.innerText = `(${b_n_val >= 0 ? '+' : ''}${b_n_val.toFixed(4)})`;

                // Orbit ring — subtle
                epicyclesGroup.append('circle')
                    .attr('cx', prevX)
                    .attr('cy', prevY)
                    .attr('r', circle.radius)
                    .attr('fill', 'none')
                    .attr('stroke', `rgba(6, 182, 212, ${Math.max(0.04, 0.12 - idx * 0.01)})`)
                    .attr('stroke-width', 0.75);

                // Radius arm
                epicyclesGroup.append('line')
                    .attr('x1', prevX).attr('y1', prevY)
                    .attr('x2', currentX).attr('y2', currentY)
                    .attr('stroke', `rgba(34, 211, 238, ${Math.min(0.9, 0.5 + idx * 0.05)})`)
                    .attr('stroke-width', idx === 0 ? 1.5 : 1);
            });

            // Update equation DOM
            const xtEl = document.getElementById('realtime-x-val');
            if (xtEl) xtEl.innerText = (xtVal >= 0 ? '+' : '') + xtVal.toFixed(6);
            const tEl = document.getElementById('realtime-t-val');
            if (tEl) tEl.innerText = time.toFixed(2);

            const classification = classifyWaveform(an_val, bn_val);
            const classBadgeEl = document.getElementById('realtime-wave-classification');
            if (classBadgeEl) classBadgeEl.innerText = classification.name;
            const equationContainer = document.getElementById('textbook-equation-container');
            if (equationContainer) equationContainer.innerHTML = classification.formulaHTML;

            let approxString = `y(t) ~ ${(a0_val / 2).toFixed(3)}`;
            let addedTermsCount = 0;
            for (let n = 1; n <= N; n++) {
                const a_n = an_val[n - 1];
                const b_n = bn_val[n - 1];
                if (Math.abs(a_n) > 0.005) {
                    approxString += ` ${a_n >= 0 ? '+' : '-'} ${Math.abs(a_n).toFixed(3)} cos(${n === 1 ? '' : n}w0t)`;
                    addedTermsCount++;
                }
                if (Math.abs(b_n) > 0.005) {
                    approxString += ` ${b_n >= 0 ? '+' : '-'} ${Math.abs(b_n).toFixed(3)} sin(${n === 1 ? '' : n}w0t)`;
                    addedTermsCount++;
                }
                if (addedTermsCount >= 4) { approxString += ' + ...'; break; }
            }
            if (addedTermsCount === 0) approxString = `y(t) ~ ${(a0_val / 2).toFixed(3)}`;
            const approxEl = document.getElementById('math-eq-expanded-approx');
            if (approxEl) approxEl.innerText = approxString;

            // Tip dot
            epicyclesGroup.append('circle')
                .attr('cx', currentX).attr('cy', currentY)
                .attr('r', 4).attr('fill', '#22d3ee');

            // Dashed connector from tip to wave start y
            epicyclesGroup.append('line')
                .attr('x1', currentX).attr('y1', currentY)
                .attr('x2', waveStartX).attr('y2', currentY)
                .attr('stroke', 'rgba(34, 211, 238, 0.25)')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '5 4');

            // ── Wave curve ──────────────────────────────────────────────────────────
            // 2 full periods shown, growing from the left as time advances
            const sampleCount = 300;
            const periodsShown = 2;
            const spanAngle = periodsShown * 2 * Math.PI;
            const margin = 8;
            const yMin = margin;
            const yMax = height - margin;

            const propagatedPoints: { x: number; y: number }[] = [];
            // Only draw up to revealProgress — use break, NOT continue (continue creates gaps → blob)
            const maxI = Math.floor(revealProgress * sampleCount);
            for (let i = 0; i <= maxI; i++) {
                const fraction = i / sampleCount;
                const x = waveStartX + fraction * waveWidth;
                const theta = time - fraction * spanAngle;

                let ySum = centerY;
                circles.forEach((circle) => {
                    ySum += circle.radius * Math.sin(circle.freq * theta + circle.phase);
                });
                // Clamp so wave never exits the canvas
                ySum = Math.max(yMin, Math.min(yMax, ySum));
                propagatedPoints.push({ x, y: ySum });
            }

            if (propagatedPoints.length > 1) {
                waveGroup.append('path')
                    .datum(propagatedPoints)
                    .attr('fill', 'none')
                    .attr('stroke', '#22d3ee')
                    .attr('stroke-width', 2)
                    .attr('stroke-linecap', 'round')
                    .attr('stroke-linejoin', 'round')
                    .attr('opacity', 0.9)
                    .attr('d', lineGenerator);
            }

            // Leading dot on the wave
            if (propagatedPoints.length > 0) {
                const lead = propagatedPoints[propagatedPoints.length - 1];
                waveGroup.append('circle')
                    .attr('cx', lead.x).attr('cy', lead.y)
                    .attr('r', 3.5).attr('fill', '#22d3ee').attr('opacity', 0.9);
            }

            // Always spin epicycles slowly; only grow wave when playing
            const playStep = isPlayingRef.current;
            if (playStep) {
                const pitchRatio = fundamentalFrequency > 0 ? (f0_val / fundamentalFrequency) : 1.0;
                const clampedRatio = Math.max(0.2, Math.min(5.0, pitchRatio));
                timeRef.current += 0.018 * speedMultiplier * clampedRatio;
                revealProgress = Math.min(1.0, revealProgress + 0.004 * speedMultiplier * clampedRatio);
            } else {
                // Idle: spin slowly so it doesn't look frozen
                timeRef.current += 0.006;
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
        <div className="wf-card overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-4 pt-3.5 pb-3 wf-border-b flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>Epicycles</h3>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        f<sub>0</sub> = <span id="realtime-f0-val" style={{ color: 'var(--accent)' }}>{fundamentalFrequency.toFixed(1)} Hz</span>
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    <Gauge className="h-3 w-3" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                    {[0.5, 1.0, 2.0].map((speed) => (
                        <button
                            key={speed}
                            onClick={() => setSpeedMultiplier(speed)}
                            className="cursor-pointer"
                            style={{
                                padding: '3px 9px',
                                borderRadius: 5,
                                fontSize: 11,
                                fontWeight: 600,
                                border: '1px solid',
                                transition: 'all 0.15s',
                                borderColor: speedMultiplier === speed ? 'var(--accent-border)' : 'var(--border)',
                                background: speedMultiplier === speed ? 'var(--accent-dim)' : 'transparent',
                                color: speedMultiplier === speed ? 'var(--accent)' : 'var(--text-muted)',
                            }}
                        >
                            {speed}x
                        </button>
                    ))}
                </div>
            </div>

            {/* SVG Canvas */}
            <div
                ref={containerRef}
                style={{
                    background: 'var(--bg-canvas)',
                    borderTop: '1px solid var(--border)',
                    minHeight: 280,
                    position: 'relative',
                    overflow: 'hidden',
                }}
            />
        </div>
    );
}
