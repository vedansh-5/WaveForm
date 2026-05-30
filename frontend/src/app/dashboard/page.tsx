'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTheme } from '@/lib/theme';
import MathFourierVisualizer from '@/components/MathFourierVisualizer';
import {
    LogOut, Mic, Square, RotateCcw, Upload,
    History, Music, HelpCircle, Activity, Waves,
    Play, Pause, ChevronDown, Sun, Moon
} from 'lucide-react';

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
    const { theme, toggle } = useTheme();

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
        const filename = filePath.split(/[\\\/]/).pop();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://waveform-api.onrender.com';
        return `${apiUrl}/uploads/${filename}`;
    };

    useEffect(() => {
        setIsPlaying(false);
        setResetSignal((prev) => prev + 1);
        setAudioPlaybackTime(0);
        setAudioDuration(0);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    }, [selectedWave]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.playbackRate = speedMultiplier;
    }, [speedMultiplier]);

    const handleTimeUpdate = () => { if (audioRef.current) setAudioPlaybackTime(audioRef.current.currentTime); };
    const handleLoadedMetadata = () => { if (audioRef.current) setAudioDuration(audioRef.current.duration); };
    const handleAudioEnded = () => {
        setIsPlaying(false);
        setResetSignal((prev) => prev + 1);
        setAudioPlaybackTime(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
    };

    useEffect(() => {
        const initDashboard = async () => {
            try {
                const data = await apiFetch('/me');
                setProfile(data.user);
                const list = await apiFetch('/recordings');
                setHistory(list || []);
                if (list && list.length > 0) setSelectedWave(list[0]);
            } catch (err) {
                console.error('Session expired:', err);
                router.push('/login');
            }
        };
        initDashboard();
    }, [router]);

    useEffect(() => {
        if (isRecording) startCanvasOscilloscope();
        else stopCanvasOscilloscope();
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

                const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
                ctx.fillStyle = isDark ? '#0d0d0c' : '#fafaf8';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Center baseline
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, canvas.height / 2);
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.stroke();

                // Waveform
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#0ea5e9';
                ctx.beginPath();
                const sliceWidth = canvas.width / bufferLength;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = (v * canvas.height) / 2;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    x += sliceWidth;
                }
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.stroke();
            };
            draw();
        } catch (err) {
            console.error('Oscilloscope failed:', err);
        }
    };

    const stopCanvasOscilloscope = () => {
        if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
        if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
        if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
        analyserRef.current = null;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
                ctx.fillStyle = isDark ? '#0d0d0c' : '#fafaf8';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, canvas.height / 2);
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.stroke();
            }
        }
    };

    const handleUpload = async () => {
        if (!audioBlob) return;
        setSyncing(true);
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'mic_recording.wav');
            formData.append('title', title.trim() || 'Acoustic Signature');
            const response = await apiFetch('/recordings', { method: 'POST', headers: {}, body: formData });
            setHistory((prev) => [response, ...prev]);
            setSelectedWave(response);
            setTitle('');
            reset();
        } catch (err: any) {
            alert(err.message || 'Upload failed. Ensure WAV PCM is captured.');
        } finally {
            setSyncing(false);
        }
    };

    const handleLogout = () => { localStorage.removeItem('wf_token'); router.push('/login'); };

    const progressPercent = Math.min((recordingTime / 30) * 100, 100);

    return (
        <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)' }}>

            {/* Header */}
            <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-base)', position: 'sticky', top: 0, zIndex: 50 }}>
                <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-strong)' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent)' }}>
                                <path d="M2 12 C3 8.5, 5 4, 7 12 C9 20, 11 4, 13 12 C15 20, 17 4, 19 12 C21 20, 22 12, 22 12"
                                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
                            Wave<span style={{ color: 'var(--accent)' }}>Form</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Theme toggle */}
                        <button onClick={toggle} title="Toggle theme"
                            className="p-2 rounded-lg wf-btn-ghost flex items-center gap-1 text-xs">
                            {theme === 'dark'
                                ? <Sun className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                                : <Moon className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />}
                        </button>

                        {profile && (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 py-1.5 pl-2 pr-3 rounded-full"
                                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                                    <img
                                        src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.name || 'U'}&backgroundColor=0e7490&textColor=ffffff`}
                                        alt="avatar"
                                        className="h-6 w-6 rounded-full"
                                        style={{ background: 'var(--bg-raised)' }}
                                    />
                                    <span className="text-xs font-medium hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>
                                        {profile.name}
                                    </span>
                                </div>
                                <button onClick={handleLogout}
                                    className="p-2 rounded-lg wf-btn-ghost"
                                    title="Sign out">
                                    <LogOut className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main */}
            <main style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                    {/* Left column */}
                    <section className="lg:col-span-5 xl:col-span-4 space-y-4">

                        {/* Recorder Card */}
                        <div className="wf-card overflow-hidden animate-fade-in">
                            <div className="px-5 pt-4 pb-3.5 wf-border-b flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Activity className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                                        Capture
                                    </h2>
                                </div>
                                {audioBlob && (
                                    <span className="wf-badge" style={{ color: 'var(--green)', background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.2)' }}>
                                        captured
                                    </span>
                                )}
                            </div>

                            {isRecording && (
                                <div className="mx-5 mt-4 mb-1 px-3 py-2.5 rounded-lg flex items-start gap-2"
                                    style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
                                    <HelpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: 'var(--amber)' }} />
                                    <p className="text-[11px] font-medium" style={{ color: 'var(--amber)' }}>
                                        <strong>max 30s</strong> — anything longer gets trimmed
                                    </p>
                                </div>
                            )}

                            <div className="px-5 pt-4">
                                <div className="relative rounded-lg overflow-hidden" style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border)' }}>
                                    <canvas ref={canvasRef} width={600} height={160}
                                        className="w-full h-[130px] oscilloscope-canvas block" />
                                    <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5">
                                        <span className={`h-1.5 w-1.5 rounded-full ${isRecording ? 'animate-pulse' : ''}`}
                                            style={{ background: isRecording ? 'var(--red)' : 'var(--text-muted)' }} />
                                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                            {recordingTime.toFixed(1)}s {recordingTime > 30 ? '(trim to 30s)' : '/ 30.0s'}
                                        </span>
                                    </div>
                                    {isRecording && (
                                        <div className="absolute bottom-0 left-0 h-[2px] transition-all duration-100"
                                            style={{ width: `${progressPercent}%`, background: 'var(--accent)' }} />
                                    )}
                                </div>
                            </div>

                            <div className="px-5 py-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    {!isRecording ? (
                                        <button onClick={startRecording} disabled={syncing}
                                            className="flex-1 py-2.5 wf-btn-primary text-[12px] tracking-wide flex items-center justify-center gap-2">
                                            <Mic className="h-3.5 w-3.5" /> Record
                                        </button>
                                    ) : (
                                        <button onClick={stopRecording}
                                            className="flex-1 py-2.5 text-[12px] font-semibold tracking-wide rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer text-white"
                                            style={{ background: 'var(--red)' }}>
                                            <Square className="h-3.5 w-3.5" /> Stop
                                        </button>
                                    )}
                                    {(audioBlob || recordingTime > 0) && (
                                        <button onClick={reset}
                                            className="p-2.5 wf-btn-ghost rounded-lg"
                                            title="Reset">
                                            <RotateCcw className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {audioUrl && (
                                    <div className="space-y-3 pt-3 animate-slide-up" style={{ borderTop: '1px solid var(--border)' }}>
                                        <audio src={audioUrl} controls className="w-full h-8 rounded-md opacity-60" />
                                        <div>
                                            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
                                                style={{ color: 'var(--text-muted)' }}>
                                                Recording title
                                            </label>
                                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                                                placeholder="e.g. high C"
                                                className="w-full px-3 py-2.5 wf-input text-sm" />
                                        </div>
                                        <button onClick={handleUpload} disabled={syncing}
                                            className="w-full py-2.5 text-[12px] font-semibold tracking-wide rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            style={{ border: '1px solid rgba(74,222,128,0.2)', color: 'var(--green)', background: 'rgba(74,222,128,0.06)' }}>
                                            <Upload className="h-3.5 w-3.5" />
                                            {syncing ? 'analyzing...' : 'Compute Fourier Decomposition'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* History */}
                        <div className="wf-card overflow-hidden animate-fade-in" style={{ animationDelay: '0.08s' }}>
                            <div className="px-5 pt-4 pb-3 wf-border-b flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <History className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                                        Saved
                                    </h2>
                                </div>
                                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{history.length}</span>
                            </div>
                            <div className="px-5 pb-4 pt-3">
                                <div className="space-y-1.5 max-h-[270px] overflow-y-auto pr-1">
                                    {history.length === 0 ? (
                                        <div className="text-center py-9 text-sm rounded-lg" style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                                            <Waves className="h-7 w-7 mx-auto mb-2 animate-float" style={{ color: 'var(--text-muted)' }} />
                                            nothing here yet
                                        </div>
                                    ) : (
                                        history.map((wave) => {
                                            const isActive = selectedWave?.recording.id === wave.recording.id;
                                            return (
                                                <div key={wave.recording.id} onClick={() => setSelectedWave(wave)}
                                                    className="px-3.5 py-2.5 rounded-lg wf-list-item flex items-center justify-between"
                                                    style={isActive ? {
                                                        borderColor: 'var(--accent-border)',
                                                        background: 'var(--accent-dim)'
                                                    } : {}}>
                                                    <div className="truncate pr-2 min-w-0">
                                                        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{wave.recording.title}</p>
                                                        <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                            {wave.equation.fundamental_frequency.toFixed(0)} Hz &middot; {wave.recording.duration}s
                                                        </p>
                                                    </div>
                                                    <Music className="h-3.5 w-3.5 shrink-0" style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Right column */}
                    <section className="lg:col-span-7 xl:col-span-8 space-y-4">
                        {selectedWave ? (
                            <div className="space-y-4 animate-fade-in">

                                {/* Visualizer */}
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

                                {/* Playback Deck */}
                                <div className="wf-card p-4 flex flex-col gap-3 animate-fade-in" style={{ animationDelay: '0.06s' }}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Music className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                                            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                                Playback
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                            {audioPlaybackTime.toFixed(1)}s / {audioDuration ? audioDuration.toFixed(1) : '0.0'}s
                                        </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="relative w-full h-1 rounded-full overflow-hidden cursor-pointer"
                                        style={{ background: 'var(--bg-raised)' }}
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const pct = (e.clientX - rect.left) / rect.width;
                                            if (audioRef.current && audioDuration) {
                                                const t = pct * audioDuration;
                                                audioRef.current.currentTime = t;
                                                setAudioPlaybackTime(t);
                                            }
                                        }}>
                                        <div className="h-full transition-all duration-100"
                                            style={{ width: `${audioDuration ? (audioPlaybackTime / audioDuration) * 100 : 0}%`, background: 'var(--accent)' }} />
                                    </div>

                                    <div className="flex items-center justify-center gap-3">
                                        <button onClick={() => {
                                            setIsPlaying(false);
                                            setResetSignal((prev) => prev + 1);
                                            setAudioPlaybackTime(0);
                                            if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
                                        }}
                                            className="p-2.5 wf-btn-ghost rounded-lg" title="Stop">
                                            <Square className="h-3.5 w-3.5" />
                                        </button>

                                        <button onClick={() => {
                                            if (!audioRef.current) return;
                                            if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
                                            else { audioRef.current.play().catch(console.error); setIsPlaying(true); }
                                        }}
                                            className="h-11 w-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                            style={{ background: 'var(--accent)' }}
                                            title={isPlaying ? 'Pause' : 'Play'}>
                                            {isPlaying
                                                ? <Pause className="h-4 w-4 fill-white text-white" />
                                                : <Play className="h-4 w-4 fill-white text-white translate-x-0.5" />}
                                        </button>
                                    </div>

                                    {selectedWave && (
                                        <audio ref={audioRef} src={getAudioUrl(selectedWave.recording.file_path)}
                                            crossOrigin="anonymous" onTimeUpdate={handleTimeUpdate}
                                            onLoadedMetadata={handleLoadedMetadata} onEnded={handleAudioEnded}
                                            className="hidden" />
                                    )}
                                </div>

                                {/* Equation Panel */}
                                <div className="wf-card overflow-hidden animate-fade-in" style={{ animationDelay: '0.12s' }}>
                                    <div className="px-5 pt-4 pb-3.5 wf-border-b">
                                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                                            Fourier Series Equation
                                        </h3>
                                    </div>

                                    <div className="px-5 pb-5 pt-4 space-y-4">
                                        <div className="p-5 rounded-lg relative overflow-hidden"
                                            style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border)' }}>

                                            {/* Wave type badge */}
                                            <div className="mb-4 flex justify-center">
                                                <span className="wf-badge" style={{ letterSpacing: '0.1em' }}>
                                                    Detected: <span id="realtime-wave-classification" className="font-mono" style={{ color: 'var(--text-primary)' }}>General Harmonic Wave</span>
                                                </span>
                                            </div>

                                            {/* Equation display */}
                                            <div id="textbook-equation-container"
                                                className="flex items-center justify-center min-h-[80px] overflow-x-auto py-2"
                                                style={{ fontFamily: 'Lora, Georgia, serif', color: 'var(--text-primary)' }}>
                                                <div className="flex items-center gap-1 text-lg sm:text-2xl tracking-normal select-none">
                                                    <span className="italic" style={{ color: 'var(--text-secondary)' }}>y(t)</span>
                                                    <span className="mx-1" style={{ color: 'var(--text-muted)' }}>=</span>
                                                    <div className="flex flex-col items-center mx-2 shrink-0">
                                                        <span className="border-b font-mono text-sm sm:text-lg px-2 pb-0.5 text-center"
                                                            style={{ borderColor: 'var(--border-strong)' }} id="realtime-eq-dc-frac">a<sub>0</sub></span>
                                                        <span className="pt-0.5 font-mono text-sm sm:text-lg">2</span>
                                                    </div>
                                                    <span className="mx-1 font-bold" style={{ color: 'var(--text-muted)' }}>+</span>
                                                    <div className="flex flex-col items-center mx-1 shrink-0">
                                                        <span className="text-[9px] font-mono mb-[-4px]" style={{ color: 'var(--text-muted)' }}>12</span>
                                                        <span className="text-2xl sm:text-4xl font-light leading-none select-none" style={{ color: 'var(--accent)' }}>&sum;</span>
                                                        <span className="text-[9px] font-mono mt-[-2px]" style={{ color: 'var(--text-muted)' }}>n=1</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0 text-xs sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
                                                        <span className="text-xl font-light mr-0.5" style={{ color: 'var(--text-muted)' }}>(</span>
                                                        <span className="font-mono text-xs sm:text-sm font-bold" id="math-eq-an-coeff" style={{ color: 'var(--accent)' }}>a<sub>n</sub></span>
                                                        <span className="italic text-xs sm:text-base" style={{ color: 'var(--text-secondary)' }}>cos</span>
                                                        <span className="text-xs sm:text-base" style={{ color: 'var(--text-muted)' }}>(</span>
                                                        <span className="italic text-[10px] sm:text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>n&omega;<sub>0</sub>t</span>
                                                        <span className="text-xs sm:text-base" style={{ color: 'var(--text-muted)' }}>)</span>
                                                        <span className="mx-0.5 font-bold" style={{ color: 'var(--text-muted)' }}>+</span>
                                                        <span className="font-mono text-xs sm:text-sm font-bold" id="math-eq-bn-coeff" style={{ color: 'var(--green)' }}>b<sub>n</sub></span>
                                                        <span className="italic text-xs sm:text-base" style={{ color: 'var(--text-secondary)' }}>sin</span>
                                                        <span className="text-xs sm:text-base" style={{ color: 'var(--text-muted)' }}>(</span>
                                                        <span className="italic text-[10px] sm:text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>n&omega;<sub>0</sub>t</span>
                                                        <span className="text-xs sm:text-base" style={{ color: 'var(--text-muted)' }}>)</span>
                                                        <span className="text-xl font-light ml-0.5" style={{ color: 'var(--text-muted)' }}>)</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Approx row */}
                                            <div className="mt-4 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                                                <p className="text-[9px] font-mono uppercase tracking-[0.15em] font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                                    Series approximation
                                                </p>
                                                <div className="font-mono text-xs overflow-x-auto whitespace-nowrap py-0.5"
                                                    id="math-eq-expanded-approx" style={{ color: 'var(--text-secondary)' }}>
                                                    y(t) ~ {(selectedWave.equation.a_0 / 2).toFixed(4)} + {selectedWave.equation.a_n[0].toFixed(4)} cos(w0t) + {selectedWave.equation.b_n[0].toFixed(4)} sin(w0t) + ...
                                                </div>
                                            </div>

                                            {/* Meta row */}
                                            <div className="flex items-center justify-between text-[10px] font-mono mt-3 pt-3"
                                                style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                                <span>Active sum: <span id="realtime-x-val" style={{ color: 'var(--accent)' }}>{(selectedWave.equation.a_0 / 2).toFixed(6)}</span></span>
                                                <span>t = <span id="realtime-t-val" style={{ color: 'var(--text-secondary)' }}>0.00</span>s</span>
                                                <span>w0 = 2π &middot; <span id="realtime-f0-eq-val">{selectedWave.equation.fundamental_frequency.toFixed(1)}</span> Hz</span>
                                            </div>

                                            {/* Harmonic list */}
                                            <div className="mt-3 font-mono text-[11px] max-h-[150px] overflow-y-auto space-y-1.5 rounded-lg p-3"
                                                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                                <div className="flex items-center justify-between pb-2 text-[10px]"
                                                    style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                                    <span>DC OFFSET</span>
                                                    <span id="realtime-dc-val" style={{ color: 'var(--accent)' }}>{(selectedWave.equation.a_0 / 2).toFixed(6)}</span>
                                                </div>
                                                {selectedWave.equation.a_n.map((_, idx) => {
                                                    const n = idx + 1;
                                                    const a_n = selectedWave.equation.a_n[idx];
                                                    const b_n = selectedWave.equation.b_n[idx];
                                                    return (
                                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1"
                                                            style={{ borderBottom: '1px solid var(--border)' }}>
                                                            <div className="flex items-center gap-1.5">
                                                                <span style={{ color: 'var(--text-muted)' }}>H{n}:</span>
                                                                <span id={`realtime-cos-coeff-eq-${n}`} style={{ color: 'var(--accent)' }}>({a_n.toFixed(4)})</span>
                                                                <span style={{ color: 'var(--text-muted)' }}>cos({n}w0t)</span>
                                                                <span id={`realtime-cos-val-eq-${n}`} style={{ color: 'var(--text-secondary)' }}>+0.000000</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span id={`realtime-sin-coeff-eq-${n}`} style={{ color: 'var(--green)' }}>({b_n.toFixed(4)})</span>
                                                                <span style={{ color: 'var(--text-muted)' }}>sin({n}w0t)</span>
                                                                <span id={`realtime-sin-val-eq-${n}`} style={{ color: 'var(--text-secondary)' }}>+0.000000</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Collapsible Coefficients */}
                                        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                                            <button onClick={() => setIsHarmonicsExpanded(!isHarmonicsExpanded)}
                                                className="w-full px-4 py-3.5 flex items-center justify-between transition-colors cursor-pointer text-left"
                                                style={{ background: 'var(--bg-surface)' }}>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                                                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                                        Harmonic Coefficients
                                                    </span>
                                                </div>
                                                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isHarmonicsExpanded ? 'rotate-180' : ''}`}
                                                    style={{ color: 'var(--text-muted)' }} />
                                            </button>

                                            {isHarmonicsExpanded && (
                                                <div className="px-4 pb-4 pt-3 wf-border-t grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                                                    {/* Cosine */}
                                                    <div>
                                                        <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2.5 flex items-center gap-2"
                                                            style={{ color: 'var(--text-muted)' }}>
                                                            <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: 'var(--accent)' }} />
                                                            Cosine a<sub>n</sub>
                                                        </h4>
                                                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                                            {selectedWave.equation.a_n.map((val, idx) => (
                                                                <div key={idx} className="flex justify-between items-center py-1.5 px-2.5 rounded-lg text-[11px] font-mono"
                                                                    style={{ background: 'var(--bg-raised)' }}>
                                                                    <div className="flex items-center gap-2">
                                                                        <span style={{ color: 'var(--text-muted)' }}>n={idx + 1}</span>
                                                                        <span id={`realtime-cos-coeff-${idx + 1}`} className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                                                            ({val >= 0 ? '+' : ''}{val.toFixed(4)})
                                                                        </span>
                                                                    </div>
                                                                    <span id={`realtime-cos-val-${idx + 1}`} className="font-semibold"
                                                                        style={{ color: val >= 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                                                                        {val >= 0 ? '+' : ''}{val.toFixed(6)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Sine */}
                                                    <div>
                                                        <h4 className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2.5 flex items-center gap-2"
                                                            style={{ color: 'var(--text-muted)' }}>
                                                            <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: 'var(--green)' }} />
                                                            Sine b<sub>n</sub>
                                                        </h4>
                                                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                                            {selectedWave.equation.b_n.map((val, idx) => (
                                                                <div key={idx} className="flex justify-between items-center py-1.5 px-2.5 rounded-lg text-[11px] font-mono"
                                                                    style={{ background: 'var(--bg-raised)' }}>
                                                                    <div className="flex items-center gap-2">
                                                                        <span style={{ color: 'var(--text-muted)' }}>n={idx + 1}</span>
                                                                        <span id={`realtime-sin-coeff-${idx + 1}`} className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                                                            ({val >= 0 ? '+' : ''}{val.toFixed(4)})
                                                                        </span>
                                                                    </div>
                                                                    <span id={`realtime-sin-val-${idx + 1}`} className="font-semibold"
                                                                        style={{ color: val >= 0 ? 'var(--green)' : 'var(--text-secondary)' }}>
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
                            <div className="wf-card flex flex-col items-center justify-center text-center p-10 animate-fade-in"
                                style={{ minHeight: 480, border: '1px dashed var(--border)' }}>
                                <HelpCircle className="h-10 w-10 mb-4 animate-float" style={{ color: 'var(--text-muted)' }} />
                                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    nothing analyzed yet
                                </h3>
                                <p className="text-sm leading-relaxed max-w-sm" style={{ color: 'var(--text-muted)' }}>
                                    Record audio, hum something rhythmic, then hit compute. The epicycles and Fourier equation will appear here.
                                </p>
                            </div>
                        )}
                    </section>

                </div>
            </main>
        </div>
    );
}