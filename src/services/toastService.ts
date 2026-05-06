import type { ToastOptions } from '#/components/atoms/Toast';

/**
 * Imperative toast API for use outside the React tree (API error handlers,
 * async helpers, etc). Inside components, prefer `useToast()`.
 *
 * Mounted by ToastProvider via `_setToastDispatch`. If a caller fires a toast
 * before the provider mounts, the message is dropped with a dev warning.
 */
type Dispatch = (opts: ToastOptions) => void;

let dispatch: Dispatch = opts => {
  console.warn('[toast] called before provider mounted:', opts.message);
};

export const _setToastDispatch = (fn: Dispatch) => {
  dispatch = fn;
};

type ShortOpts = Omit<ToastOptions, 'message' | 'type'>;

export const toastService = {
  success: (message: string, opts?: ShortOpts) =>
    dispatch({ ...opts, message, type: 'success' }),
  error: (message: string, opts?: ShortOpts) =>
    dispatch({ ...opts, message, type: 'error' }),
  info: (message: string, opts?: ShortOpts) =>
    dispatch({ ...opts, message, type: 'info' }),
};
