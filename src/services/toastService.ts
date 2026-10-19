import type { ToastOptions, ToastPresenter } from '#platform/presenters';
import { HapticService } from '#services/haptic/HapticService';
import { logger } from '#/utils/environment';

/**
 * The toast API, in and out of the React tree alike. `ToastProvider` mounts it
 * via `_setToastDispatch`; a toast fired before that is dropped with a warning.
 */
let dispatch: ToastPresenter = opts => {
  logger.warn('[toast] called before provider mounted:', opts.message);
};

export const _setToastDispatch = (fn: ToastPresenter) => {
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
