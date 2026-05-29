'use client';

import { apiFetch, setAuthSession } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2, Sun, Moon } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const { theme, toggle } = useTheme();

    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Session auto-redirect
    useEffect(() => {
        const checkSession = async () => {
            const token = localStorage.getItem('wf_token');
            if (token) {
                try {
                    await apiFetch('/me');
                    router.push('/dashboard');
                } catch {
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
                const data = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
                setAuthSession(data.token);
                router.push('/dashboard');
            } else {
                await apiFetch('/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) });
                const data = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
                setAuthSession(data.token);
                router.push('/dashboard');
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleOAuth = () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        window.location.href = `${apiUrl}/auth/google`;
    };

    return (
        <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }} className="flex flex-col items-center justify-center p-4 relative overflow-hidden">

            {/* Subtle grain texture feel */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.018]"
                style={{
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
                    backgroundSize: '200px 200px',
                }}
            />

            {/* Theme Toggle — top right */}
            <div className="absolute top-4 right-4">
                <button
                    onClick={toggle}
                    className="wf-btn-ghost p-2 rounded-lg flex items-center gap-1.5 text-xs"
                    title="Toggle theme"
                >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
            </div>

            <div className="w-full max-w-[380px] animate-fade-in">

                {/* Logo */}
                <div className="text-center mb-7">
                    <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl wf-border wf-surface mb-4"
                        style={{ border: '1px solid var(--border-strong)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent)' }}>
                            <path d="M2 12 C3 8.5, 5 4, 7 12 C9 20, 11 4, 13 12 C15 20, 17 4, 19 12 C21 20, 22 12, 22 12"
                                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                        Wave<span style={{ color: 'var(--accent)' }}>Form</span>
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
                        {isLogin ? 'sign in to your acoustic lab' : 'create an account to get started'}
                    </p>
                </div>

                {/* Card */}
                <div className="wf-card p-6">

                    {/* Error */}
                    {error && (
                        <div className="mb-4 px-3.5 py-3 rounded-lg text-sm font-medium flex items-start gap-2"
                            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)', color: 'var(--red)' }}>
                            <span className="shrink-0 mt-0.5 text-xs">!</span>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3.5">

                        {!isLogin && (
                            <div className="animate-slide-up">
                                <label className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5"
                                    style={{ color: 'var(--text-muted)' }}>
                                    Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                                        placeholder="Nikola Tesla"
                                        className="w-full pl-9 pr-4 py-2.5 wf-input text-sm" />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5"
                                style={{ color: 'var(--text-muted)' }}>
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full pl-9 pr-4 py-2.5 wf-input text-sm" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5"
                                style={{ color: 'var(--text-muted)' }}>
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-9 pr-4 py-2.5 wf-input text-sm" />
                            </div>
                        </div>

                        <button type="submit" disabled={loading}
                            className="w-full py-2.5 wf-btn-primary text-sm flex items-center justify-center gap-2 mt-1">
                            {loading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> working...</>
                            ) : (
                                <>{isLogin ? 'Sign in' : 'Create account'} <ArrowRight className="h-4 w-4" /></>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-5 flex items-center">
                        <div className="flex-1 wf-border-b" />
                        <span className="px-3 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>or</span>
                        <div className="flex-1 wf-border-b" />
                    </div>

                    {/* Google */}
                    <button onClick={handleGoogleOAuth}
                        className="w-full py-2.5 wf-btn-ghost text-sm flex items-center justify-center gap-2.5 rounded-lg">
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>
                </div>

                {/* Toggle */}
                <div className="mt-5 text-center">
                    <button onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        className="text-sm cursor-pointer transition-colors"
                        style={{ color: 'var(--text-muted)' }}>
                        {isLogin
                            ? <>No account? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign up</span></>
                            : <>Have an account? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</span></>}
                    </button>
                </div>
            </div>
        </div>
    );
}