'use client';

import { apiFetch, setAuthSession } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Session auto-redirect check
    useEffect(() => {
        const checkSession = async () => {
            const token = localStorage.getItem('wf_token');
            if (token) {
                try {
                    // Try fetching user profile to verify if session is still valid
                    await apiFetch('/me');
                    router.push('/dashboard');
                } catch (err) {
                    // Invalid/expired token: clear it from storage silently
                    localStorage.removeItem('wf_token');
                }
            }
        };
        checkSession();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isLogin) {
                const data = await apiFetch('/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password }),
                });
                setAuthSession(data.token);
                router.push('/dashboard');
            } else {
                await apiFetch('/signup', {
                    method: 'POST',
                    body: JSON.stringify({ email, password, name }),
                });

                const data = await apiFetch('/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password }),
                });
                setAuthSession(data.token);
                router.push('/dashboard');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleOAuth = () => {
        window.location.href = 'http://localhost:8080/auth/google';
    };

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-[#050507] overflow-hidden">
            {/* Animated ambient orbs */}
            <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-violet-600/8 animate-glow-pulse pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-fuchsia-600/6 animate-glow-pulse pointer-events-none" style={{ animationDelay: '1.5s' }} />
            <div className="absolute top-[60%] left-[60%] w-[300px] h-[300px] rounded-full bg-emerald-600/4 animate-glow-pulse pointer-events-none" style={{ animationDelay: '3s' }} />

            {/* Animated floating wave lines (SVG background) */}
            <svg
                className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04]"
                viewBox="0 0 1440 900"
                preserveAspectRatio="xMidYMid slice"
            >
                <path
                    d="M0,450 C360,350 720,550 1080,450 C1260,400 1350,500 1440,450"
                    className="wave-bg-line"
                    stroke="url(#wave-line-grad)"
                    strokeWidth="2"
                >
                    <animateTransform
                        attributeName="transform"
                        type="translate"
                        values="0,0; 0,-30; 0,0"
                        dur="8s"
                        repeatCount="indefinite"
                    />
                </path>
                <path
                    d="M0,500 C240,420 480,580 720,500 C960,420 1200,580 1440,500"
                    className="wave-bg-line"
                    stroke="url(#wave-line-grad)"
                    strokeWidth="1.5"
                >
                    <animateTransform
                        attributeName="transform"
                        type="translate"
                        values="0,0; 0,25; 0,0"
                        dur="10s"
                        repeatCount="indefinite"
                    />
                </path>
                <path
                    d="M0,400 C180,340 540,460 900,400 C1080,370 1260,430 1440,400"
                    className="wave-bg-line"
                    stroke="url(#wave-line-grad)"
                    strokeWidth="1"
                >
                    <animateTransform
                        attributeName="transform"
                        type="translate"
                        values="0,0; 0,20; 0,0"
                        dur="12s"
                        repeatCount="indefinite"
                    />
                </path>
                <defs>
                    <linearGradient id="wave-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="50%" stopColor="#d946ef" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Login Card */}
            <div className="relative w-full max-w-[420px] animate-fade-in z-10">
                {/* Logo & Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 mb-5 shadow-lg shadow-violet-500/20">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                            <path d="M2 12 C2 12, 4 4, 6 12 C8 20, 10 4, 12 12 C14 20, 16 4, 18 12 C20 20, 22 12, 22 12" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">
                        Wave<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Form</span>
                    </h1>
                    <p className="mt-2.5 text-sm text-zinc-500 leading-relaxed max-w-[280px] mx-auto">
                        {isLogin
                            ? 'Sign in to your acoustic laboratory'
                            : 'Create your account to start analyzing sound'}
                    </p>
                </div>

                {/* Glass Card */}
                <div className="p-7 sm:p-8 rounded-2xl glass-panel">
                    {/* Error Banner */}
                    {error && (
                        <div className="mb-5 p-3.5 rounded-xl bg-rose-500/8 border border-rose-500/15 text-[13px] text-rose-400 font-medium flex items-start gap-2.5">
                            <div className="h-4 w-4 rounded-full border-2 border-rose-400/50 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-[10px]">!</span>
                            </div>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name field (signup only) */}
                        {!isLogin && (
                            <div className="animate-slide-up">
                                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                                    Display Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Nikola Tesla"
                                        className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tesla@acoustics.com"
                                    className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl glow-button text-white text-sm font-bold tracking-wider uppercase cursor-pointer flex items-center justify-center gap-2 mt-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    {isLogin ? 'Sign In' : 'Create Account'}
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-7 flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-800/80" />
                        </div>
                        <span className="relative px-4 text-[10px] font-bold text-zinc-600 bg-[#0a0a0f] uppercase tracking-[0.2em]">
                            Or continue with
                        </span>
                    </div>

                    {/* Google OAuth */}
                    <button
                        onClick={handleGoogleOAuth}
                        className="w-full py-3 px-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-800/40 text-zinc-400 hover:text-white transition-all duration-300 flex items-center justify-center gap-3 text-sm font-medium cursor-pointer group"
                    >
                        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                        </svg>
                        <span className="group-hover:translate-x-0.5 transition-transform">Continue with Google</span>
                    </button>
                </div>

                {/* Toggle Link */}
                <div className="mt-7 text-center">
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                        }}
                        className="text-[13px] text-zinc-500 hover:text-violet-400 font-medium tracking-wide transition-colors cursor-pointer"
                    >
                        {isLogin ? (
                            <>Don&apos;t have an account? <span className="text-violet-400 font-semibold">Sign Up</span></>
                        ) : (
                            <>Already registered? <span className="text-violet-400 font-semibold">Sign In</span></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}