/**
 * Lightweight toast notification system.
 *
 * Uses a shared ref (via `useState` for SSR safety) so any component
 * can push a toast from anywhere — pages, stores, async handlers —
 * without prop-drilling. The global `<ToastStack>` component renders
 * them in a fixed corner.
 *
 * Intentionally not a full-featured notification library; we only
 * need success / error / info, auto-dismiss after a few seconds, and
 * a stable id so the transition animation doesn't jitter.
 */

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

const DEFAULT_TIMEOUT_MS = 4_500;

let nextId = 1;

export function useToast() {
  const toasts = useState<Toast[]>('app-toasts', () => []);

  function push(toast: Omit<Toast, 'id'>, timeout = DEFAULT_TIMEOUT_MS) {
    const id = nextId++;
    toasts.value = [...toasts.value, { id, ...toast }];
    if (timeout > 0 && import.meta.client) {
      setTimeout(() => dismiss(id), timeout);
    }
    return id;
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  const success = (title: string, description?: string) =>
    push({ variant: 'success', title, description });
  const error = (title: string, description?: string) =>
    push({ variant: 'error', title, description });
  const info = (title: string, description?: string) =>
    push({ variant: 'info', title, description });

  return { toasts, push, dismiss, success, error, info };
}
