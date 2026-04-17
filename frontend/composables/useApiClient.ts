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
    const rawMessage = Array.isArray(body.message)
      ? body.message[0]
      : String(body.message);
    const friendly = humaniseError(body.errorCode, rawMessage, body.statusCode);
    const normalised = new Error(friendly || 'Request failed');
    (normalised as Error & { errorCode?: string }).errorCode = body.errorCode;
    (normalised as Error & { statusCode?: number }).statusCode = body.statusCode;
    // Preserve the raw backend text for debugging panels/logs.
    (normalised as Error & { rawMessage?: string }).rawMessage = rawMessage;
    return normalised;
  }
  // Network / CORS / timeout failures surface without a structured body.
  if (fetchError?.response === undefined && fetchError?.message) {
    return new Error(
      "We couldn't reach the server. Please check your connection and try again.",
    );
  }
  if (err instanceof Error) return err;
  return new Error('Request failed');
}

/**
 * Map backend `errorCode`s and raw validation strings to copy that is
 * safe to show end users. Falls back to a light cleanup of the raw
 * message when no specific mapping is available so we never surface
 * stack-trace-ish strings.
 */
function humaniseError(
  code: string | undefined,
  raw: string,
  status?: number,
): string {
  switch (code) {
    case 'VALIDATION_ERROR':
      // The raw message from class-validator is already user-oriented
      // (e.g. "email must be an email"); just make the first letter
      // uppercase so it reads like a sentence.
      return capitalise(raw);
    case 'AGENT_NOT_FOUND':
      return 'That agent no longer exists. Refresh the page and try again.';
    case 'AGENT_INACTIVE':
      return 'This agent is inactive and can no longer be assigned to transactions.';
    case 'AGENT_EMAIL_IN_USE':
      return 'Another agent is already using that email address.';
    case 'TRANSACTION_NOT_FOUND':
      return "We couldn't find that transaction. It may have been deleted.";
    case 'TRANSACTION_ALREADY_COMPLETED':
      return 'This transaction is already completed and cannot be changed.';
    case 'INVALID_STAGE_TRANSITION':
      return 'Stages can only move forward one step at a time.';
    case 'COMMISSION_BREAKDOWN_NOT_FOUND':
      return 'The commission breakdown is only available once the transaction reaches Completed.';
    case 'COMMISSION_BREAKDOWN_ALREADY_EXISTS':
      return 'A commission breakdown already exists for this transaction.';
    case 'COMMISSION_CALCULATION_ERROR':
      return 'We could not calculate the commission breakdown. Please contact support.';
    case 'REFERENCE_CODE_COLLISION':
      return 'A rare reference code clash occurred. Please try again.';
    case 'INVALID_REFERENCE_CODE':
      return 'That reference code is not valid.';
    case 'NOT_FOUND':
      return "We couldn't find what you were looking for.";
    case 'INTERNAL_ERROR':
      return 'Something went wrong on our side. Please try again in a moment.';
    default:
      break;
  }
  if (status === 401 || status === 403) {
    return "You don't have permission to perform that action.";
  }
  if (status === 429) {
    return 'Too many requests in a short window — please slow down and retry.';
  }
  if (status && status >= 500) {
    return 'The server is having trouble right now. Please try again in a moment.';
  }
  return capitalise(raw) || 'Request failed';
}

function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
