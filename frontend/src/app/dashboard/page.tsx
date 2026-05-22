'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import MathFourierVisualizer from '@/components/MathFourierVisualizer';
import { LogOut, Mic, Square, RotateCcw, Upload, History, User, Music, HelpCircle } from 'lucide-react';
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
    const { isRecording, recordingTime, audioBlob, audioUrl, startRecording, stopRecording, reset } = useAudioRecorder(30);
    // 1. Fetch Profile and Session History
    useEffect(() => {
        const initDashboard = async () => {
            try {
                const data = await apiFetch('/me');
                setProfile(data.user);
                const list = await apiFetch('/recordings');
                setHistory(list || []);
                if (list && list.length > 0) {
                    setSelectedWave(list[0]); // Auto-load recent equations
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
                // Draw center baseline guide
                ctx.strokeStyle = 'rgba(139, 92, 246, 0.05)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, canvas.height / 2);
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.stroke();
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#8b5cf6'; // Violet glow trace
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
        // Reset canvas to flat baseline
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#08080c';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = 'rgba(139, 92, 246, 0.1)';
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
            // Ensure it is wrapped in standard 16-bit PCM WAV container
            formData.append('audio', audioBlob, 'mic_recording.wav');
            formData.append('title', title.trim() || 'Acoustic Signature');
            const response = await apiFetch('/recordings', {
                method: 'POST',
                headers: {
                    // Remove default Content-Type so fetch can set the boundary headers automatically
                },
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
    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden pb-16">
            {/* Dynamic ambient backgrounds */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-emerald-600/5 blur-[120px] pointer-events-none" />
            {/* Main Navigation Header */}
            <header className="border-b border-zinc-900 bg-zinc-950/30 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center font-black tracking-tight text-white text-base">
                            W
                        </div>
                        <span className="text-lg font-extrabold tracking-tight">
                            Wave<span className="text-violet-400">Form</span>
                        </span>
                    </div>
                    {profile && (
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3 bg-zinc-900/50 py-1.5 pl-2 pr-4 rounded-full border border-zinc-800">
                                <img
                                    src={profile.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg'}
                                    alt="avatar"
                                    className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700"
                                />
                                <span className="text-xs font-semibold text-zinc-300">{profile.name}</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="text-zinc-400 hover:text-red-400 transition-colors p-1.5 hover:bg-zinc-900/60 rounded-xl cursor-pointer"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </header>
            {/* Workspace Grid */}
            <main className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Audio Capture Card & Equation History */}
                <section className="lg:col-span-4 space-y-8">

                    {/* Real-time Web Audio Recorder */}
                    <div className="p-6 rounded-3xl glass-panel relative overflow-hidden">
                        <h2 className="text-xs font-bold tracking-widest text-zinc-500 uppercase flex items-center gap-2 mb-4">
                            <Mic className="h-3 w-3 text-violet-400" /> Acoustic Capture
                        </h2>
                        {/* Oscilloscope Canvas */}
                        <canvas
                            ref={canvasRef}
                            width={400}
                            height={140}
                            className="w-full h-[140px] rounded-2xl bg-zinc-950/90 border border-zinc-900 overflow-hidden mb-4"
                        />
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-zinc-700'}`} />
                                <span className="text-xs font-mono font-bold text-zinc-400">
                                    {recordingTime.toFixed(1)} / 30.0s
                                </span>
                            </div>
                            {audioBlob && (
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1 bg-emerald-950/30 border border-emerald-500/10 px-2 py-0.5 rounded-md">
                                    Captured
                                </span>
                            )}
                        </div>
                        {/* Main Audio Controls */}
                        <div className="flex items-center gap-3 mb-6">
                            {!isRecording ? (
                                <button
                                    onClick={startRecording}
                                    disabled={syncing}
                                    className="flex-1 py-3 px-4 rounded-xl glow-button text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Mic className="h-4 w-4" /> Start
                                </button>
                            ) : (
                                <button
                                    onClick={stopRecording}
                                    className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                                >
                                    <Square className="h-4 w-4" /> Stop
                                </button>
                            )}
                            {(audioBlob || recordingTime > 0) && (
                                <button
                                    onClick={reset}
                                    className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 text-zinc-400 hover:text-white transition-all cursor-pointer"
                                >
                                    <RotateCcw className="h-4.5 w-4.5" />
                                </button>
                            )}
                        </div>
                        {/* Audio Playback & Title Fields */}
                        {audioUrl && (
                            <div className="space-y-4 pt-4 border-t border-zinc-900">
                                <audio src={audioUrl} controls className="w-full h-8 opacity-80" />
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Equation Title</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g., Soprano High C"
                                        className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                                    />
                                </div>
                                <button
                                    onClick={handleUpload}
                                    disabled={syncing}
                                    className="w-full py-3 rounded-xl border border-emerald-500/20 bg-emerald-600/10 hover:bg-emerald-600/25 text-emerald-400 hover:text-emerald-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                                >
                                    <Upload className="h-3.5 w-3.5" /> {syncing ? 'Analyzing Coefficients...' : 'Compute Fourier Decomposition'}
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Database History List */}
                    <div className="p-6 rounded-3xl glass-panel">
                        <h2 className="text-xs font-bold tracking-widest text-zinc-500 uppercase flex items-center gap-2 mb-4">
                            <History className="h-3.5 w-3.5" /> Saved Syntheses ({history.length})
                        </h2>
                        <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                            {history.length === 0 ? (
                                <div className="text-center py-8 text-zinc-600 text-xs border border-dashed border-zinc-900 rounded-2xl">
                                    No syntheses found. Record voice patterns to populate database history.
                                </div>
                            ) : (
                                history.map((wave) => (
                                    <div
                                        key={wave.recording.id}
                                        onClick={() => setSelectedWave(wave)}
                                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${selectedWave?.recording.id === wave.recording.id
                                            ? 'border-violet-500/30 bg-violet-600/5'
                                            : 'border-zinc-900 hover:border-zinc-800 bg-zinc-950/20'
                                            }`}
                                    >
                                        <div className="truncate pr-2">
                                            <h4 className="text-xs font-bold text-white truncate">{wave.recording.title}</h4>
                                            <span className="text-[10px] text-zinc-500 mt-1 block">
                                                {wave.equation.fundamental_frequency.toFixed(0)} Hz • {wave.recording.duration}s
                                            </span>
                                        </div>
                                        <Music className={`h-3.5 w-3.5 shrink-0 ${selectedWave?.recording.id === wave.recording.id ? 'text-violet-400' : 'text-zinc-600'
                                            }`} />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>
                {/* Right Column: Fourier Series Simulation Deck */}
                <section className="lg:col-span-8 space-y-8">
                    {selectedWave ? (
                        <div className="space-y-8">
                            {/* Dynamic D3 Mathematical Simulation Canvas */}
                            <MathFourierVisualizer
                                a0={selectedWave.equation.a_0}
                                an={selectedWave.equation.a_n}
                                bn={selectedWave.equation.b_n}
                                fundamentalFrequency={selectedWave.equation.fundamental_frequency}
                            />
                            {/* Formula & Numeric Expansion Tables */}
                            <div className="p-6 rounded-3xl glass-panel">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Fourier Series Equation</h3>

                                {/* Mathematical notation rendering */}
                                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-900 overflow-x-auto mb-6 text-center">
                                    <p className="text-xs text-zinc-400 font-serif leading-6">
                                        x(t) ≈ <span className="text-violet-400 font-mono">{(selectedWave.equation.a_0 / 2).toFixed(4)}</span> +
                                        <span className="block my-2 text-zinc-500 text-[10px]">
                                            ∑ ( a_n * cos(n * ω_0 * t) + b_n * sin(n * ω_0 * t) )
                                        </span>
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Cosine Array (a_n) Table */}
                                    <div>
                                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Cosine Harmonics (a_n)</h4>
                                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                            {selectedWave.equation.a_n.map((val, idx) => (
                                                <div key={idx} className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-zinc-900/30 text-[11px] font-mono">
                                                    <span className="text-zinc-500">n = {idx + 1}</span>
                                                    <span className={val >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{val.toFixed(6)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Sine Array (b_n) Table */}
                                    <div>
                                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Sine Harmonics (b_n)</h4>
                                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                            {selectedWave.equation.b_n.map((val, idx) => (
                                                <div key={idx} className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-zinc-900/30 text-[11px] font-mono">
                                                    <span className="text-zinc-500">n = {idx + 1}</span>
                                                    <span className={val >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{val.toFixed(6)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[500px] rounded-3xl glass-panel border-dashed border-zinc-800 flex flex-col items-center justify-center text-center p-8">
                            <HelpCircle className="h-12 w-12 text-zinc-700 mb-4 animate-bounce" />
                            <h3 className="text-lg font-bold text-zinc-400">No Audio Wave Analyzed Yet</h3>
                            <p className="text-xs text-zinc-600 max-w-sm mt-2">
                                Turn on your microphone above, speak or hum a pattern, and trigger the Fourier Series Decomposition engine to visualize the harmonic epicycles.
                            </p>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}