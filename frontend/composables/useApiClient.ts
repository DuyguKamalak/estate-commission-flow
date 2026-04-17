import type { FetchError } from 'ofetch';
import type { ApiErrorBody } from '~/types/api';

/**
 * Imperative counterpart to `useApiFetch`. While `useApiFetch` wraps
 * Nuxt's `useFetch` (for SSR-friendly, reactive data in pages and
 * components), this composable returns a plain `$fetch` bound to the
 * backend base URL — ideal for Pinia stores and event handlers that
 * want to trigger mutations imperatively (`await client.post(...)`).
 *
 * Errors thrown by `$fetch` are normalised into plain `Error` objects
 * whose `.message` is the backend's human-readable message (or the
 * first array entry if `class-validator` returned a list), so stores
 * don't have to parse the error body themselves.
 */
export function useApiClient() {
  const { public: publicConfig } = useRuntimeConfig();
  const baseURL = publicConfig.apiBaseUrl ?? 'http://localhost:3001/api';

  const request = async <T>(
    path: string,
    options: Parameters<typeof $fetch>[1] = {},
  ): Promise<T> => {
    try {
      return await $fetch<T>(path, { baseURL, ...options });
    } catch (err) {
      throw normaliseError(err);
    }
  };

  return {
    get: <T>(path: string, query?: Record<string, unknown>) =>
      request<T>(path, { method: 'GET', query: stripNil(query) }),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: 'POST',
        body: body as Parameters<typeof $fetch>[1] extends { body?: infer B }
          ? B
          : never,
      }),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: 'PATCH',
        body: body as Parameters<typeof $fetch>[1] extends { body?: infer B }
          ? B
          : never,
      }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
}

/**
 * Strips keys whose value is `undefined` / `null` / `''` so the query
 * string stays clean (e.g. `?stage=&search=foo` becomes `?search=foo`).
 */
function stripNil(
  obj: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

function normaliseError(err: unknown): Error {
  const fetchError = err as FetchError<ApiErrorBody>;
  const body = fetchError?.data;
  if (body && typeof body === 'object' && 'message' in body) {
    const message = Array.isArray(body.message)
      ? body.message[0]
      : String(body.message);
    const normalised = new Error(message || 'Request failed');
    (normalised as Error & { errorCode?: string }).errorCode = body.errorCode;
    (normalised as Error & { statusCode?: number }).statusCode = body.statusCode;
    return normalised;
  }
  if (err instanceof Error) return err;
  return new Error('Request failed');
}
