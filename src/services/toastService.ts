import type { ToastOptions } from '#/components/atoms/Toast';
import { HapticService } from '#services/haptic/HapticService';
import { logger } from '#/utils/environment';

/**
 * Imperative toast API for use outside the React tree; inside components prefer
 * `useToast()`. ToastProvider mounts it via `_setToastDispatch` — a toast fired
 * before that is dropped with a dev warning.
 */
type Dispatch = (opts: ToastOptions) => void;

let dispatch: Dispatch = opts => {
  logger.warn('[toast] called before provider mounted:', opts.message);
};

export const _setToastDispatch = (fn: Dispatch) => {
  dispatch = fn;
};

type ShortOpts = Omit<ToastOptions, 'message' | 'type'>;

// Haptics are paired with the toast type here so every consumer gets them.
// `info` is neutral and deliberately stays silent.
export const toastService = {
  success: (message: string, opts?: ShortOpts) => {
    HapticService.success();
    return dispatch({ ...opts, message, type: 'success' });
  },
  error: (message: string, opts?: ShortOpts) => {
    HapticService.error();
    return dispatch({ ...opts, message, type: 'error' });
  },
  info: (message: string, opts?: ShortOpts) =>
    dispatch({ ...opts, message, type: 'info' }),
  warning: (message: string, opts?: ShortOpts) => {
    HapticService.warning();
    return dispatch({ ...opts, message, type: 'warning' });
  },
};
