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
 *
 * Note on typing: Nuxt 3's `useFetch` has an intricate conditional return
 * type (`T extends void ? unknown : T`) that makes a trivial generic
 * pass-through flagged as incompatible by `vue-tsc`. We therefore cast
 * the options bag to `UseFetchOptions<unknown>` — the runtime behaviour
 * is identical and the consumer still sees the precise `AsyncData<T>`
 * shape at the call site.
 */
export function useApiFetch<T>(
  path: string,
  options: UseFetchOptions<T> = {},
) {
  const { public: publicConfig } = useRuntimeConfig();
  const base = publicConfig.apiBaseUrl ?? 'http://localhost:3001/api';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetcher = useFetch as unknown as (...args: unknown[]) => any;
  return fetcher(path, {
    baseURL: base,
    ...options,
  }) as ReturnType<typeof useFetch<T>>;
}
