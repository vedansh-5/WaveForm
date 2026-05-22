'use client';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAuthSession } from '@/lib/api';
function CallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            setAuthSession(token);
            router.push('/dashboard');
        } else {
            router.push('/login?error=oauth_failed');
        }
    }, [searchParams, router]);
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black">
            <div className="relative flex flex-col items-center p-8 rounded-2xl glass-panel max-w-sm w-full text-center">
                {/* Animated outer neon ring */}
                <div className="absolute inset-0 rounded-2xl border border-violet-500/30 animate-pulse pointer-events-none" />

                {/* Sleek rotating ring loader */}
                <div className="h-12 w-12 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin mb-6" />

                <h2 className="text-xl font-bold tracking-wider text-white">Completing Handshake</h2>
                <p className="mt-2 text-sm text-zinc-400">Syncing secure Google tokens with your account...</p>
            </div>
        </div>
    );
}
export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-black">
                <div className="h-8 w-8 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
            </div>
        }>
            <CallbackHandler />
        </Suspense>
    );
}