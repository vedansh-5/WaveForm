'use client'

import { apiFetch, setAuthSession } from "@/lib/api";
import { useRouter } from "next/navigation"
import { useState } from "react";

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isLogin) {
                // signin
                const data = await apiFetch('/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password }),
                });
                setAuthSession(data.token);
                router.push('/dashboard');
            } else {
                // register
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
            setError(err.message || 'An unexpected error occured. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleOAuth = () => {
        window.location.href = 'http://localhost:8080/auth/google';
    };

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center p-4 bg-black overflow-hidden">
            {/* Decorative ambient background glows */}
            <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-violet-600/10 blur-[100px]" />
            <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-emerald-600/5 blur-[100px]" />
            <div className="relative max-w-md w-full p-8 rounded-3xl glass-panel relative z-10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">
                        Wave<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500">Form</span>
                    </h1>
                    <p className="mt-2 text-sm text-zinc-400">
                        {isLogin ? 'Sign in to access your digital acoustics laboratory' : 'Create an account to start computing Fourier series equations'}
                    </p>
                </div>
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium tracking-wide">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {!isLogin && (
                        <div>
                            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Display Name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Nikola Tesla"
                                className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tesla@acoustics.com"
                            className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 rounded-xl glass-input text-sm"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl glow-button text-white text-sm font-bold tracking-wider uppercase cursor-pointer"
                    >
                        {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
                    </button>
                </form>
                <div className="relative my-8 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-800" />
                    </div>
                    <span className="relative px-4 text-xs font-bold text-zinc-500 bg-black uppercase tracking-widest">Or Continue With</span>
                </div>
                <button
                    onClick={handleGoogleOAuth}
                    className="w-full py-3 px-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70 text-zinc-300 hover:text-white transition-all duration-300 flex items-center justify-center gap-3 text-sm font-medium cursor-pointer"
                >
                    {/* Flat Google SVG Icon */}
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                    </svg>
                    Authentication via Google
                </button>
                <div className="mt-8 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-xs text-violet-400 hover:text-violet-300 font-medium tracking-wide underline underline-offset-4 cursor-pointer"
                    >
                        {isLogin ? "Don't have an account? Sign Up" : 'Already registered? Sign In'}
                    </button>
                </div>
            </div>
        </div>
    );
}