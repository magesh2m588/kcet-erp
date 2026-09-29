export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('kcet_auth_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('kcet_auth_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('kcet_auth_token');
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeAuthToken();
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.detail || `Request failed with status ${response.status}`);
  }

  return data as T;
}
