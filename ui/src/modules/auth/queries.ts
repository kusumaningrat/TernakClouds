import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { clearTokens, getRefreshToken, storeTokens } from '@/lib/auth';
import type { LoginInput, MeResponse, RegisterInput, RegisterResponse, TokenResponse } from './types';

export function useLogin() {
  return useMutation<TokenResponse, ApiError, LoginInput>({
    mutationFn: (input) => api.post('/api/v1/auth/login', input, false),
    onSuccess: (data) => {
      storeTokens(data.access_token, data.refresh_token);
    },
  });
}

export function useRegister() {
  return useMutation<RegisterResponse, ApiError, RegisterInput>({
    mutationFn: (input) => api.post('/api/v1/auth/register', input, false),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: async () => {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          await api.post('/api/v1/auth/logout', { refresh_token: refreshToken }, false);
        } catch {
          /* ignore */
        }
      }
    },
    onSettled: () => {
      clearTokens();
      queryClient.clear();
    },
  });
}

export function useMe() {
  return useQuery<MeResponse, ApiError>({
    queryKey: ['me'],
    queryFn: () => api.get('/api/v1/auth/me'),
    staleTime: 60_000,
  });
}
