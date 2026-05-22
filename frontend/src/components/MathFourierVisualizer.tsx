'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
interface VisualizerProps {
    a0: number;
    an: number[];
    bn: number[];
    fundamentalFrequency: number;
}

export default function MathFourierVisualizer({ a0, an, bn, fundamentalFrequency }: VisualizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [speedMultiplier, setSpeedMultiplier] = useState(1);
    const animationRef = useRef<number | null>(null);
    useEffect(() => {
        if (!containerRef.current) return;
        // Clear previous SVG contents
        d3.select(containerRef.current).selectAll('*').remove();
        const width = containerRef.current.clientWidth || 600;
        const height = 400;
        const centerX = width * 0.35;
        const centerY = height / 2;
        const svg = d3.select(containerRef.current)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('class', 'overflow-visible');
        // Create container groups for crisp separation
        const epicyclesGroup = svg.append('g');
        const waveGroup = svg.append('g');
        // Generate harmonic structures: size, frequency multiplier, phase angle
        const circles: { radius: number; freq: number; phase: number }[] = [];
        const N = an.length;
        // Scale coefficient amplitudes to fit nicely on screen
        const maxAmplitude = Math.max(...an.map(Math.abs), ...bn.map(Math.abs), 0.01);
        const scaleFactor = 80.0 / maxAmplitude;
        for (let i = 0; i < N; i++) {
            const n = i + 1;
            const a = an[i] * scaleFactor;
            const b = bn[i] * scaleFactor;
            // Amplitude: R = sqrt(a_n^2 + b_n^2)
            const radius = Math.sqrt(a * a + b * b);
            // Phase: theta = atan2(b_n, a_n)
            const phase = Math.atan2(b, a);
            if (radius > 0.5) { // Skip negligible noise vectors
                circles.push({ radius, freq: n, phase });
            }
        }
        // Sort circles in descending order by radius for clean epicyclic ordering
        circles.sort((a, b) => b.radius - a.radius);
        const wavePoints: { x: number; y: number }[] = [];
        const waveHistoryLimit = width * 0.55;
        let time = 0;
        // Direct path line drawing functions
        const lineGenerator = d3.line<{ x: number; y: number }>()
            .x((d) => d.x)
            .y((d) => d.y);
        const drawLoop = () => {
            // 1. Compute rotating vector offsets
            let currentX = centerX;
            let currentY = centerY + (a0 * scaleFactor * 0.5); // Start at the DC offset baseline
            epicyclesGroup.selectAll('*').remove();
            circles.forEach((circle) => {
                const prevX = currentX;
                const prevY = currentY;
                // Angle = (frequency * time) + phase offset
                const angle = circle.freq * time + circle.phase;
                currentX += circle.radius * Math.cos(angle);
                currentY += circle.radius * Math.sin(angle);
                // Draw rotating guides
                epicyclesGroup.append('circle')
                    .attr('cx', prevX)
                    .attr('cy', prevY)
                    .attr('r', circle.radius)
                    .attr('fill', 'none')
                    .attr('stroke', 'rgba(139, 92, 246, 0.09)')
                    .attr('stroke-width', 1.5);
                // Draw vector arrows
                epicyclesGroup.append('line')
                    .attr('x1', prevX)
                    .attr('y1', prevY)
                    .attr('x2', currentX)
                    .attr('y2', currentY)
                    .attr('stroke', 'rgba(167, 139, 250, 0.75)')
                    .attr('stroke-width', 2);
            });
            // 2. Track reconstructed wave point
            wavePoints.unshift({ x: centerX + 180, y: currentY });
            // Keep trace within visual constraints
            if (wavePoints.length > waveHistoryLimit) {
                wavePoints.pop();
            }
            // Draw connection line from epicycle tip to wave trace
            epicyclesGroup.append('line')
                .attr('x1', currentX)
                .attr('y1', currentY)
                .attr('x2', centerX + 180)
                .attr('y2', currentY)
                .attr('stroke', 'rgba(244, 63, 94, 0.4)')
                .attr('stroke-dasharray', '3,3')
                .attr('stroke-width', 1);
            // 3. Render wave graph
            waveGroup.selectAll('*').remove();
            // Shift wave trace rightward over time to animate the propagation
            const propagatedPoints = wavePoints.map((pt, idx) => ({
                x: pt.x + idx * 1.0,
                y: pt.y,
            }));
            waveGroup.append('path')
                .datum(propagatedPoints)
                .attr('fill', 'none')
                .attr('stroke', 'url(#wave-gradient)')
                .attr('stroke-width', 3)
                .attr('d', lineGenerator);
            // Draw active probe pointer
            if (propagatedPoints.length > 0) {
                waveGroup.append('circle')
                    .attr('cx', propagatedPoints[0].x)
                    .attr('cy', propagatedPoints[0].y)
                    .attr('r', 4.5)
                    .attr('fill', '#f43f5e')
                    .attr('class', 'animate-pulse');
            }
            // Increment clock based on selected speed
            time += 0.02 * speedMultiplier;
            animationRef.current = requestAnimationFrame(drawLoop);
        };
        // Set up linear gradient highlights for the wave trace
        const defs = svg.append('defs');
        const grad = defs.append('linearGradient')
            .attr('id', 'wave-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e'); // Dynamic rose red at probe origin
        grad.append('stop').attr('offset', '100%').attr('stop-color', '#8b5cf6'); // Electric violet tail
        // Start rendering loop
        drawLoop();
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [a0, an, bn, speedMultiplier]);
    return (
        <div className="relative p-6 rounded-3xl glass-panel w-full">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Fourier Series Epicycles</h3>
                    <p className="text-xs text-zinc-400 mt-1">
                        Fundamental Pitch Frequency: <span className="text-violet-400 font-mono">{fundamentalFrequency.toFixed(1)} Hz</span>
                    </p>
                </div>
                {/* Speed Controls */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Speed</span>
                    {[0.5, 1.0, 2.0].map((speed) => (
                        <button
                            key={speed}
                            onClick={() => setSpeedMultiplier(speed)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${speedMultiplier === speed
                                    ? 'border-violet-500 bg-violet-600/20 text-white'
                                    : 'border-zinc-800 bg-transparent text-zinc-400 hover:text-white'
                                }`}
                        >
                            {speed}x
                        </button>
                    ))}
                </div>
            </div>
            <div ref={containerRef} className="w-full h-[400px] border border-zinc-900 rounded-2xl bg-zinc-950/40 relative overflow-hidden" />
        </div>
    );
}