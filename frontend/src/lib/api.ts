const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';


// helper to retrieve jwt token from local storage
export const getAuthToken = (): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('wf_token');
    }
    return null;
};

// helper to set session details
export const setAuthSession = (token: string) => {
    localStorage.setItem('wf_token', token);
};

// central fetch wrapper that automatically appends JWT Bearer tokens
export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    const headers = new Headers(options.headers || {});

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
}