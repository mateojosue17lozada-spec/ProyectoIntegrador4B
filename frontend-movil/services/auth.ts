import { apiFetch } from './api';

export type LoginResponse = {
  token: string;
  usuario: {
    id_usuario: number;
    nombre: string;
    correo: string;
    rol: string;
  };
};

export async function login(correo: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { correo, password },
  });
}

export async function getProfile(token: string) {
  return apiFetch<{ usuario: LoginResponse['usuario'] }>('/api/auth/profile', { token });
}
