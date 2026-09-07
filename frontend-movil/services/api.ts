import { Platform } from 'react-native';

/**
 * Base URL for the backend API.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL env variable (set in .env)
 * 2. Platform-based defaults:
 *    - Android emulator: 10.0.2.2:3000
 *    - Everything else: localhost:3000
 */
const getBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');

  // ⚠️ CAMBIADO: Ahora usa HTTPS para producción
  // Si estás en modo desarrollo y quieres usar localhost, descomenta lo de abajo
  /*
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
  */

  // ✅ Por defecto, usa la URL de producción en HTTPS
  return 'https://optica-integral.duckdns.org';
};

export const API_BASE = getBaseUrl();

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
};

/**
 * Thin wrapper around `fetch` that adds JSON headers and auth token.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, headers: extra } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ mensaje: res.statusText }));
    throw new ApiError(res.status, errorBody?.mensaje || 'Error del servidor');
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
