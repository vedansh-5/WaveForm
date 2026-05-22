'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import MathFourierVisualizer from '@/components/MathFourierVisualizer';
import { LogOut, Mic, Square, RotateCcw, Upload, History, Music, HelpCircle, Activity, Waves, Play, Pause } from 'lucide-react';

interface WaveEquation {
    recording: {
        id: string;
        title: string;
        duration: number;
        file_path: string;
        created_at: string;
    };
    equation: {
        a_0: number;
        a_n: number[];
        b_n: number[];
        fundamental_frequency: number;
    };
}

export default function DashboardPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [history, setHistory] = useState<WaveEquation[]>([]);
    const [selectedWave, setSelectedWave] = useState<WaveEquation | null>(null);
        const [title, setTitle] = useState('');
    const [syncing, setSyncing] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);

    // Unified Audio & Fourier Sync States
    const [isPlaying, setIsPlaying] = useState(false);
    const [resetSignal, setResetSignal] = useState(0);
    const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
    const [isHarmonicsExpanded, setIsHarmonicsExpanded] = useState(false);
    const [audioPlaybackTime, setAudioPlaybackTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const { isRecording, recordingTime, audioBlob, audioUrl, startRecording, stopRecording, reset } = useAudioRecorder(120);

    const getAudioUrl = (filePath: string) => {
        if (!filePath) return '';
        const filename = filePath.split(/[\\/]/).pop();
        return `http://localhost:8080/uploads/${filename}`;
    };

    // Reset playback deck when a new wave is selected
    useEffect(() => {
        setIsPlaying(false);
        setResetSignal((prev) => prev + 1);
        setAudioPlaybackTime(0);
        setAudioDuration(0);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }, [selectedWave]);

    // Synchronize playbackRate of the audio element with the D3 speed multiplier
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = speedMultiplier;
        }
    }, [speedMultiplier]);

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setAudioPlaybackTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setAudioDuration(audioRef.current.duration);
        }
    };

    const handleAudioEnded = () => {
        setIsPlaying(false);
        setResetSignal((prev) => prev + 1);
        setAudioPlaybackTime(0);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
        }
    };

    // 1. Fetch Profile and Session History
    useEffect(() => {
        const initDashboard = async () => {
            try {
                const data = await apiFetch('/me');
                setProfile(data.user);
                const list = await apiFetch('/recordings');
                setHistory(list || []);
                if (list && list.length > 0) {
                    setSelectedWave(list[0]);
                }
            } catch (err) {
                console.error('Session expired or DB handshake failed:', err);
                router.push('/login');
            }
        };
        initDashboard();
    }, [router]);

    // 2. Real-Time Oscilloscope Visualizer using Canvas
    useEffect(() => {
        if (isRecording) {
            startCanvasOscilloscope();
        } else {
            stopCanvasOscilloscope();
        }
        return () => stopCanvasOscilloscope();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRecording]);

    const startCanvasOscilloscope = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            analyserRef.current = analyser;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const draw = () => {
                if (!analyserRef.current) return;
                animationFrameRef.current = requestAnimationFrame(draw);
                analyserRef.current.getByteTimeDomainData(dataArray);

                ctx.fillStyle = '#08080c';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Grid lines (subtle)
                ctx.strokeStyle = 'rgba(139, 92, 246, 0.03)';
                ctx.lineWidth = 1;
                for (let y = canvas.height * 0.25; y < canvas.height; y += canvas.height * 0.25) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(canvas.width, y);
                    ctx.stroke();
                }

                // Glow effect behind waveform
                ctx.shadowColor = '#8b5cf6';
                ctx.shadowBlur = 12;

                // Waveform
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#8b5cf6';
                ctx.beginPath();
                const sliceWidth = canvas.width / bufferLength;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = (v * canvas.height) / 2;
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                    x += sliceWidth;
                }
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            };
            draw();
        } catch (err) {
            console.error('Failed to start canvas loop:', err);
        }
    };

    const stopCanvasOscilloscope = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((track) => track.stop());
            micStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#08080c';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                // Draw flat baseline
                ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, canvas.height / 2);
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.stroke();
            }
        }
    };

    // 3. File Upload & Processing Handler
    const handleUpload = async () => {
        if (!audioBlob) return;
        setSyncing(true);
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'mic_recording.wav');
            formData.append('title', title.trim() || 'Acoustic Signature');
            const response = await apiFetch('/recordings', {
                method: 'POST',
                headers: {},
                body: formData,
            });
            setHistory((prev) => [response, ...prev]);
            setSelectedWave(response);
            setTitle('');
            reset();
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Verification rejected this file. Ensure WAV PCM is captured.');
        } finally {
            setSyncing(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('wf_token');
        router.push('/login');
    };

    const progressPercent = Math.min((recordingTime / 30) * 100, 100);

    return (
        <div className="min-h-screen bg-[#050507] text-zinc-200 relative overflow-hidden">
            {/* Ambient background orbs */}
            <div className="fixed top-0 right-0 w-[600px] h-[600px] rounded-full bg-violet-600/4 blur-[150px] pointer-events-none animate-glow-pulse" />
            <div className="fixed bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-fuchsia-600/3 blur-[130px] pointer-events-none animate-glow-pulse" style={{ animationDelay: '2s' }} />

            {/* Navigation Header */}
            <header className="border-b border-white/[0.04] bg-[#050507]/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/15">
                            <Waves className="h-4.5 w-4.5 text-white" />
                        </div>
                        <span className="text-lg font-extrabold tracking-tight hidden sm:inline">
                            Wave<span className="text-violet-400">Form</span>
                        </span>
                    </div>
                    {profile && (
                        <div className="flex items-center gap-3 sm:gap-5">
                            <div className="flex items-center gap-2.5 bg-white/[0.03] py-1.5 pl-2 pr-3.5 rounded-full border border-white/[0.06]">
                                <img
                                    src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.name || 'U'}&backgroundColor=7c3aed&textColor=ffffff`}
                                    alt="avatar"
                                    className="h-7 w-7 rounded-full bg-zinc-800 border border-white/[0.08]"
                                />
                                <span className="text-xs font-semibold text-zinc-300 hidden sm:inline">{profile.name}</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="text-zinc-500 hover:text-rose-400 transition-colors p-2 hover:bg-white/[0.03] rounded-xl cursor-pointer"
                                title="Sign out"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Workspace */}
            <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                    {/* ─── Left Column: Audio Capture & History ─── */}
                    <section className="lg:col-span-5 xl:col-span-4 space-y-6">

                        {/* Audio Recorder Card */}
                        <div className="rounded-2xl glass-panel overflow-hidden animate-fade-in">
                            {/* Card Header */}
                            <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 flex items-center justify-between">
                                <h2 className="text-[11px] font-bold tracking-[0.15em] text-zinc-500 uppercase flex items-center gap-2">
                                    <Activity className="h-3.5 w-3.5 text-violet-400" />
                                    Acoustic Capture
                                </h2>
                                {audioBlob && (
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.15em] bg-emerald-500/8 border border-emerald-500/10 px-2.5 py-1 rounded-lg">
                                        ✓ Captured
                                    </span>
                                )}
                            </div>

                            {/* Live Recording Truncation Warning */}
                            {isRecording && (
                                <div className="mx-5 sm:mx-6 mb-3.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 animate-pulse flex items-start gap-2.5">
                                    <HelpCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                    <div className="text-[11px] text-amber-200/80 leading-normal font-medium">
                                        <span className="font-bold text-amber-300">Max Duration: 30s.</span> Any audio captured beyond 30 seconds will be automatically trimmed when computed.
                                    </div>
                                </div>
                            )}

                            {/* Oscilloscope Canvas */}
                            <div className="px-5 sm:px-6">
                                <div className="relative rounded-xl overflow-hidden border border-white/[0.04] bg-[#08080c]">
                                    <canvas
                                        ref={canvasRef}
                                        width={600}
                                        height={160}
                                        className="w-full h-[140px] sm:h-[160px] oscilloscope-canvas block"
                                    />
                                    {/* Timer overlay */}
                                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                        <span className={`h-2 w-2 rounded-full ${isRecording ? 'bg-rose-500 animate-pulse' : 'bg-zinc-700'}`} />
                                        <span className="text-[11px] font-mono font-bold text-zinc-400 tabular-nums">
                                            {recordingTime.toFixed(1)}s {recordingTime > 30 ? '(Trimming to 30.0s)' : '/ 30.0s'}
                                        </span>
                                    </div>
                                    {/* Progress bar */}
                                    {isRecording && (
                                        <div className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-100"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="px-5 sm:px-6 py-5 sm:py-6 space-y-4">
                                <div className="flex items-center gap-3">
                                    {!isRecording ? (
                                        <button
                                            onClick={startRecording}
                                            disabled={syncing}
                                            className="flex-1 py-3 px-4 rounded-xl glow-button text-white text-[13px] font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 cursor-pointer"
                                        >
                                            <Mic className="h-4 w-4" /> Record
                                        </button>
                                    ) : (
                                        <button
                                            onClick={stopRecording}
                                            className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[13px] font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 cursor-pointer transition-colors shadow-lg shadow-rose-600/20"
                                        >
                                            <Square className="h-3.5 w-3.5" /> Stop
                                        </button>
                                    )}
                                    {(audioBlob || recordingTime > 0) && (
                                        <button
                                            onClick={reset}
                                            className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-zinc-500 hover:text-white transition-all cursor-pointer"
                                            title="Reset recording"
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Post-recording: Playback + Upload */}
                                {audioUrl && (
                                    <div className="space-y-4 pt-4 border-t border-white/[0.04] animate-slide-up">
                                        <audio src={audioUrl} controls className="w-full h-9 opacity-70 rounded-lg" />
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-2">
                                                Equation Title
                                            </label>
                                            <input
                                                type="text"
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                placeholder="e.g., Soprano High C"
                                                className="w-full px-4 py-2.5 rounded-xl glass-input text-sm"
                                            />
                                        </div>
                                        <button
                                            onClick={handleUpload}
                                            disabled={syncing}
                                            className="w-full py-3 rounded-xl border border-emerald-500/15 bg-emerald-500/6 hover:bg-emerald-500/12 text-emerald-400 hover:text-emerald-300 font-bold text-[13px] uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                                        >
                                            <Upload className="h-3.5 w-3.5" />
                                            {syncing ? 'Analyzing Coefficients...' : 'Compute Fourier Decomposition'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Saved History List */}
                        <div className="rounded-2xl glass-panel overflow-hidden animate-fade-in" style={{ animationDelay: '0.1s' }}>
                            <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-3">
                                <h2 className="text-[11px] font-bold tracking-[0.15em] text-zinc-500 uppercase flex items-center gap-2">
                                    <History className="h-3.5 w-3.5 text-violet-400" />
                                    Saved Syntheses
                                    <span className="ml-auto text-violet-400/60 font-mono text-[10px]">{history.length}</span>
                                </h2>
                            </div>
                            <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                                    {history.length === 0 ? (
                                        <div className="text-center py-10 text-zinc-600 text-xs border border-dashed border-white/[0.06] rounded-xl">
                                            <Waves className="h-8 w-8 mx-auto mb-3 text-zinc-700 animate-float" />
                                            No syntheses found yet.
                                            <br />
                                            <span className="text-zinc-700">Record your first audio pattern above.</span>
                                        </div>
                                    ) : (
                                        history.map((wave) => (
                                            <div
                                                key={wave.recording.id}
                                                onClick={() => setSelectedWave(wave)}
                                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                                                    selectedWave?.recording.id === wave.recording.id
                                                        ? 'border-violet-500/25 bg-violet-600/6 shadow-lg shadow-violet-500/5'
                                                        : 'border-white/[0.04] hover:border-white/[0.08] bg-white/[0.01] hover:bg-white/[0.02]'
                                                }`}
                                            >
                                                <div className="truncate pr-3 min-w-0">
                                                    <h4 className="text-[13px] font-semibold text-zinc-200 truncate">{wave.recording.title}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] text-zinc-500 font-mono">
                                                            {wave.equation.fundamental_frequency.toFixed(0)} Hz
                                                        </span>
                                                        <span className="text-zinc-800">•</span>
                                                        <span className="text-[10px] text-zinc-600">
                                                            {wave.recording.duration}s
                                                        </span>
                                                    </div>
                                                </div>
                                                <Music className={`h-4 w-4 shrink-0 transition-colors ${
                                                    selectedWave?.recording.id === wave.recording.id
                                                        ? 'text-violet-400'
                                                        : 'text-zinc-700 group-hover:text-zinc-500'
                                                }`} />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ─── Right Column: Fourier Results ─── */}
                    <section className="lg:col-span-7 xl:col-span-8 space-y-6">
                        {selectedWave ? (
                            <div className="space-y-6 animate-fade-in">
                                {/* Epicycle Visualizer */}
                                <MathFourierVisualizer
                                    a0={selectedWave.equation.a_0}
                                    an={selectedWave.equation.a_n}
                                    bn={selectedWave.equation.b_n}
                                    fundamentalFrequency={selectedWave.equation.fundamental_frequency}
                                    isPlaying={isPlaying}
                                    resetSignal={resetSignal}
                                    speedMultiplier={speedMultiplier}
                                    setSpeedMultiplier={setSpeedMultiplier}
                                    audioRef={audioRef}
                                />

                                {/* Unified Audio Control Deck */}
                                <div className="rounded-2xl glass-panel p-5 flex flex-col gap-4 animate-fade-in" style={{ animationDelay: '0.08s' }}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Music className="h-4 w-4 text-violet-400" />
                                            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Acoustic Playback Deck</span>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-zinc-500 tabular-nums">
                                            {audioPlaybackTime.toFixed(1)}s / {audioDuration ? audioDuration.toFixed(1) : '0.0'}s
                                        </span>
                                    </div>

                                    {/* Sleek Seek/Progress Bar */}
                                    <div className="relative w-full h-1.5 rounded-full bg-white/[0.04] border border-white/[0.02] overflow-hidden cursor-pointer"
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const clickX = e.clientX - rect.left;
                                            const width = rect.width;
                                            const clickPercentage = clickX / width;
                                            if (audioRef.current && audioDuration) {
                                                const newTime = clickPercentage * audioDuration;
                                                audioRef.current.currentTime = newTime;
                                                setAudioPlaybackTime(newTime);
                                            }
                                        }}
                                    >
                                        <div
                                            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-100"
                                            style={{ width: `${audioDuration ? (audioPlaybackTime / audioDuration) * 100 : 0}%` }}
                                        />
                                    </div>

                                    {/* Controls */}
                                    <div className="flex items-center justify-center gap-4">
                                        {/* Stop/Reset */}
                                        <button
                                            onClick={() => {
                                                setIsPlaying(false);
                                                setResetSignal((prev) => prev + 1);
                                                setAudioPlaybackTime(0);
                                                if (audioRef.current) {
                                                    audioRef.current.pause();
                                                    audioRef.current.currentTime = 0;
                                                }
                                            }}
                                            className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.05] hover:border-white/[0.1] text-zinc-400 hover:text-white transition-all cursor-pointer"
                                            title="Stop & Reset Visuals"
                                        >
                                            <Square className="h-4 w-4 fill-zinc-400" />
                                        </button>

                                        {/* Play/Pause */}
                                        <button
                                            onClick={() => {
                                                if (!audioRef.current) return;
                                                if (isPlaying) {
                                                    audioRef.current.pause();
                                                    setIsPlaying(false);
                                                } else {
                                                    audioRef.current.play().catch(console.error);
                                                    setIsPlaying(true);
                                                }
                                            }}
                                            className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                            title={isPlaying ? 'Pause' : 'Play Audio'}
                                        >
                                            {isPlaying ? (
                                                <Pause className="h-5 w-5 fill-white text-white" />
                                            ) : (
                                                <Play className="h-5 w-5 fill-white text-white translate-x-0.5" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Hidden HTML5 Audio Element */}
                                    {selectedWave && (
                                        <audio
                                            ref={audioRef}
                                            src={getAudioUrl(selectedWave.recording.file_path)}
                                            crossOrigin="anonymous"
                                            onTimeUpdate={handleTimeUpdate}
                                            onLoadedMetadata={handleLoadedMetadata}
                                            onEnded={handleAudioEnded}
                                            className="hidden"
                                        />
                                    )}
                                </div>

                                {/* Highlighted Equation & Collapsible Coefficients */}
                                <div className="rounded-2xl glass-panel overflow-hidden animate-fade-in" style={{ animationDelay: '0.15s' }}>
                                    <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Fourier Series Equation</h3>
                                    </div>

                                    <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-5">
                                        {/* Dynamic Highlighted Equation Box */}
                                         <div className="p-5 sm:p-6 rounded-xl bg-violet-950/10 border border-violet-500/20 shadow-lg shadow-violet-500/5 text-center relative overflow-hidden">
                                             {/* Ambient glow inside */}
                                             <div className="absolute -top-12 -left-12 w-24 h-24 rounded-full bg-violet-500/10 blur-xl pointer-events-none" />

                                             <div className="relative z-10 space-y-4">
                                                 {/* Mathematical Formula Display - Realtime Equation Representation */}
                                                 <div className="p-4 rounded-xl bg-violet-950/15 border border-violet-500/10 font-mono text-[11px] sm:text-xs text-zinc-200 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center justify-center gap-2 py-3.5 shadow-inner">
                                                     <span className="text-zinc-500 font-bold shrink-0">x(t) ≈</span>
                                                     <span id="realtime-eq-dc" className="text-violet-400 font-extrabold tabular-nums shrink-0">{(selectedWave.equation.a_0 / 2).toFixed(4)}</span>
                                                     
                                                     <span className="text-zinc-600 font-bold shrink-0">+</span>
                                                     <span id="realtime-eq-cos-1" className="text-fuchsia-400 font-extrabold tabular-nums shrink-0">({selectedWave.equation.a_n[0].toFixed(4)})</span>
                                                     <span className="text-zinc-400 shrink-0">·cos(ω₀t)</span>
                                                     
                                                     <span className="text-zinc-600 font-bold shrink-0">+</span>
                                                     <span id="realtime-eq-sin-1" className="text-emerald-400 font-extrabold tabular-nums shrink-0">({selectedWave.equation.b_n[0].toFixed(4)})</span>
                                                     <span className="text-zinc-400 shrink-0">·sin(ω₀t)</span>
                                                     
                                                     <span className="text-zinc-600 font-bold shrink-0">+</span>
                                                     <span id="realtime-eq-cos-2" className="text-fuchsia-400 font-extrabold tabular-nums shrink-0">({selectedWave.equation.a_n[1].toFixed(4)})</span>
                                                     <span className="text-zinc-400 shrink-0">·cos(2ω₀t)</span>
                                                     
                                                     <span className="text-zinc-600 font-bold shrink-0">+</span>
                                                     <span id="realtime-eq-sin-2" className="text-emerald-400 font-extrabold tabular-nums shrink-0">({selectedWave.equation.b_n[1].toFixed(4)})</span>
                                                     <span className="text-zinc-400 shrink-0">·sin(2ω₀t)</span>
                                                     
                                                     <span className="text-zinc-600 font-extrabold shrink-0">+ ...</span>
                                                 </div>

                                                 <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-mono px-1 gap-1">
                                                     <span>Active Sum: <span id="realtime-x-val" className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 tabular-nums">{(selectedWave.equation.a_0 / 2).toFixed(6)}</span></span>
                                                     <span>Expanded Harmonic Terms (12 Harmonics)</span>
                                                 </div>

                                                 {/* Beautifully Styled, Scrollable Harmonic Equation list */}
                                                 <div className="bg-[#08080c]/80 border border-white/[0.04] rounded-xl p-4 font-mono text-[11px] text-zinc-300 max-h-[160px] overflow-y-auto space-y-2.5 text-left custom-scrollbar scrollbar-thin">
                                                     <div className="border-b border-white/[0.04] pb-2 text-[10px] text-zinc-500 flex items-center justify-between">
                                                         <span>CONSTANT TERM (DC OFFSET)</span>
                                                         <span id="realtime-dc-val" className="text-violet-400 font-bold">{(selectedWave.equation.a_0 / 2).toFixed(6)}</span>
                                                     </div>
                                                     
                                                     {selectedWave.equation.a_n.map((_, idx) => {
                                                         const n = idx + 1;
                                                         const a_n = selectedWave.equation.a_n[idx];
                                                         const b_n = selectedWave.equation.b_n[idx];
                                                         return (
                                                             <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 py-1.5 border-b border-white/[0.02] last:border-0">
                                                                 <div className="flex items-center gap-1.5 truncate">
                                                                     <span className="text-zinc-600 font-bold shrink-0">H{n}:</span>
                                                                     <span id={`realtime-cos-coeff-eq-${n}`} className="text-fuchsia-400 text-[10px] font-semibold shrink-0">({a_n.toFixed(4)})</span>
                                                                     <span className="text-zinc-400 font-semibold shrink-0">· cos({n}ω₀t)</span>
                                                                     <span id={`realtime-cos-val-eq-${n}`} className="text-violet-400 font-bold tabular-nums">
                                                                         +0.000000
                                                                     </span>
                                                                 </div>
                                                                 <div className="flex items-center gap-1.5 truncate sm:ml-auto">
                                                                     <span id={`realtime-sin-coeff-eq-${n}`} className="text-emerald-400 text-[10px] font-semibold shrink-0">({b_n.toFixed(4)})</span>
                                                                     <span className="text-zinc-400 font-semibold shrink-0">· sin({n}ω₀t)</span>
                                                                     <span id={`realtime-sin-val-eq-${n}`} className="text-teal-400 font-bold tabular-nums">
                                                                         +0.000000
                                                                     </span>
                                                                 </div>
                                                             </div>
                                                         );
                                                     })}
                                                 </div>

                                                 {/* Bottom Metadata */}
                                                 <div className="text-[10px] text-zinc-500 mt-2 font-mono flex items-center justify-center gap-4 border-t border-white/[0.04] pt-3">
                                                     <span>ω₀ = 2π · <span id="realtime-f0-eq-val">{selectedWave.equation.fundamental_frequency.toFixed(1)}</span> Hz</span>
                                                     <span className="text-zinc-700">|</span>
                                                     <span>t = <span id="realtime-t-val" className="text-zinc-300">0.00</span>s</span>
                                                 </div>
                                             </div>
                                         </div>

                                        {/* Collapsible Spectrum Menu */}
                                        <div className="border border-white/[0.04] rounded-xl overflow-hidden bg-white/[0.01]">
                                            <button
                                                onClick={() => setIsHarmonicsExpanded(!isHarmonicsExpanded)}
                                                className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer text-left"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                                                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                                        Harmonic Spectrum Coefficients
                                                    </span>
                                                </div>
                                                <svg
                                                    className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${isHarmonicsExpanded ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>

                                            {isHarmonicsExpanded && (
                                                <div className="px-5 pb-5 pt-3 border-t border-white/[0.04] grid grid-cols-1 sm:grid-cols-2 gap-5 animate-fade-in">
                                                    {/* Cosine Harmonics */}
                                                    <div>
                                                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                                                            Cosine Harmonics (a<sub>n</sub>)
                                                        </h4>
                                                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                                            {selectedWave.equation.a_n.map((val, idx) => (
                                                                <div key={idx} className="flex justify-between items-center py-2 px-3 rounded-lg bg-white/[0.015] hover:bg-white/[0.03] transition-colors border border-white/[0.02] text-[11px] font-mono">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-zinc-600">n = {idx + 1}</span>
                                                                        <span id={`realtime-cos-coeff-${idx + 1}`} className="text-[9px] text-zinc-500">({val >= 0 ? '+' : ''}{val.toFixed(4)})</span>
                                                                    </div>
                                                                    <span id={`realtime-cos-val-${idx + 1}`} className={`font-semibold ${val >= 0 ? 'text-violet-400' : 'text-fuchsia-400'}`}>
                                                                        {val >= 0 ? '+' : ''}{val.toFixed(6)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Sine Harmonics */}
                                                    <div>
                                                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-500" />
                                                            Sine Harmonics (b<sub>n</sub>)
                                                        </h4>
                                                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                                            {selectedWave.equation.b_n.map((val, idx) => (
                                                                <div key={idx} className="flex justify-between items-center py-2 px-3 rounded-lg bg-white/[0.015] hover:bg-white/[0.03] transition-colors border border-white/[0.02] text-[11px] font-mono">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-zinc-600">n = {idx + 1}</span>
                                                                        <span id={`realtime-sin-coeff-${idx + 1}`} className="text-[9px] text-zinc-500">({val >= 0 ? '+' : ''}{val.toFixed(4)})</span>
                                                                    </div>
                                                                    <span id={`realtime-sin-val-${idx + 1}`} className={`font-semibold ${val >= 0 ? 'text-emerald-400' : 'text-teal-400'}`}>
                                                                        {val >= 0 ? '+' : ''}{val.toFixed(6)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Empty State */
                            <div className="h-[500px] rounded-2xl glass-panel border-dashed border-white/[0.06] flex flex-col items-center justify-center text-center p-8 animate-fade-in">
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 rounded-full bg-violet-500/10 blur-xl animate-glow-pulse" />
                                    <HelpCircle className="h-14 w-14 text-zinc-700 animate-float relative" />
                                </div>
                                <h3 className="text-lg font-bold text-zinc-300">No Audio Wave Analyzed Yet</h3>
                                <p className="text-[13px] text-zinc-600 max-w-sm mt-3 leading-relaxed">
                                    Turn on your microphone, speak or hum a pattern, and trigger the Fourier Series Decomposition engine to visualize the harmonic epicycles.
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}