import type { UseFetchOptions } from 'nuxt/app';

/**
 * Thin wrapper around Nuxt's `useFetch` that transparently prefixes every
 * request with the backend base URL from `runtimeConfig.public.apiBaseUrl`.
 *
 * Usage:
 *   const { data, pending, error } = await useApiFetch<Transaction[]>('/transactions');
 *
 * Keeping this as a single composable means we have one place to add
 * cross-cutting concerns later (auth headers, request IDs, retry policy).
 */
export function useApiFetch<T>(
  path: string,
  options: UseFetchOptions<T> = {},
) {
  const { public: publicConfig } = useRuntimeConfig();
  const base = publicConfig.apiBaseUrl ?? 'http://localhost:3001/api';

  return useFetch<T>(path, {
    baseURL: base,
    ...options,
  });
}
