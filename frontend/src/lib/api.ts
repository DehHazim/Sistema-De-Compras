const BASE = import.meta.env.VITE_API_URL ?? '/api';

let token: string | null = localStorage.getItem('sic.token');

export function setToken(value: string | null) {
  token = value;
  if (value) localStorage.setItem('sic.token', value);
  else localStorage.removeItem('sic.token');
}

export function getToken() {
  return token;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.json);
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      if (location.pathname !== '/login') location.href = '/login';
    }
    const msg = (isJson && (payload as { error?: string }).error) || `Erro ${res.status}`;
    throw new ApiError(res.status, msg, isJson ? (payload as { details?: unknown }).details : undefined);
  }
  return payload as T;
}
