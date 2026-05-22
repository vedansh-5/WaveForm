'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Gauge } from 'lucide-react';

interface VisualizerProps {
    a0: number;
    an: number[];
    bn: number[];
    fundamentalFrequency: number;
}

export default function MathFourierVisualizer({ a0, an, bn, fundamentalFrequency }: VisualizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [speedMultiplier, setSpeedMultiplier] = useState(1);
    const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
    const animationRef = useRef<number | null>(null);

    // Responsive resize observer
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w = entry.contentRect.width;
                // Maintain a responsive aspect ratio
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

        // Build harmonic circle descriptors
        const circles: { radius: number; freq: number; phase: number }[] = [];
        const N = an.length;
        const maxAmplitude = Math.max(...an.map(Math.abs), ...bn.map(Math.abs), 0.01);
        const maxRadius = isMobile ? 50 : 80;
        const scaleFactor = maxRadius / maxAmplitude;

        for (let i = 0; i < N; i++) {
            const n = i + 1;
            const a = an[i] * scaleFactor;
            const b = bn[i] * scaleFactor;
            const radius = Math.sqrt(a * a + b * b);
            const phase = Math.atan2(b, a);
            if (radius > 0.5) {
                circles.push({ radius, freq: n, phase });
            }
        }
        circles.sort((a, b) => b.radius - a.radius);

        const wavePoints: { x: number; y: number }[] = [];
        const waveHistoryLimit = Math.floor(width * 0.5);
        let time = 0;

        const lineGenerator = d3.line<{ x: number; y: number }>()
            .x((d) => d.x)
            .y((d) => d.y)
            .curve(d3.curveBasisOpen);

        const drawLoop = () => {
            let currentX = centerX;
            let currentY = centerY + (a0 * scaleFactor * 0.5);
            epicyclesGroup.selectAll('*').remove();

            circles.forEach((circle, idx) => {
                const prevX = currentX;
                const prevY = currentY;
                const angle = circle.freq * time + circle.phase;
                currentX += circle.radius * Math.cos(angle);
                currentY += circle.radius * Math.sin(angle);

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

            // Tip dot
            epicyclesGroup.append('circle')
                .attr('cx', currentX)
                .attr('cy', currentY)
                .attr('r', 3)
                .attr('fill', '#f43f5e');

            wavePoints.unshift({ x: waveStartX, y: currentY });
            if (wavePoints.length > waveHistoryLimit) {
                wavePoints.pop();
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

            time += 0.02 * speedMultiplier;
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
    }, [a0, an, bn, speedMultiplier, dimensions]);

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
                        f₀ = <span className="text-violet-400">{fundamentalFrequency.toFixed(1)} Hz</span>
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