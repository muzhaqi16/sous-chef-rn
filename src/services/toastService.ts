import type { ToastOptions, ToastPresenter } from '#platform/presenters';
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

// What the person is being shown, which a request that would interrupt them
// (the App Store rating) waits on.
let toastsShowing = false;
let troubleAt: number | null = null;
const quietWaits = new Set<() => void>();

/** The host's report: a toast is on screen or queued. */
export const _setToastsShowing = (showing: boolean) => {
  toastsShowing = showing;
  quietWaits.forEach(rearm => {
    rearm();
  });
};

/** An error the person saw, a toast or an alert. */
export const noteTrouble = () => {
  troubleAt = Date.now();
};

/** When the person last saw an error this session; null for never. */
export const lastTroubleAt = () => troubleAt;

/** @internal Test seam: no toast showing, no trouble seen, nothing waiting. */
export const _resetToastMoments = () => {
  toastsShowing = false;
  troubleAt = null;
  quietWaits.clear();
};

/**
 * Runs `then` once no toast has shown for `quietMs`, so an Undo it offered has
 * gone; a toast restarts the wait. Returns what cancels it.
 */
export function whenToastsQuiet(quietMs: number, then: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    clearTimeout(timer);
    quietWaits.delete(rearm);
  };
  const rearm = () => {
    clearTimeout(timer);
    if (toastsShowing) return;
    timer = setTimeout(() => {
      cancel();
      then();
    }, quietMs);
  };
  quietWaits.add(rearm);
  rearm();
  return cancel;
}

type ShortOpts = Omit<ToastOptions, 'message' | 'type'>;

/** A host pairs each toast type with its own feedback (the mobile one, a haptic). */
export const toastService = {
  success: (message: string, opts?: ShortOpts) =>
    dispatch({ ...opts, message, type: 'success' }),
  error: (message: string, opts?: ShortOpts) => {
    noteTrouble();
    dispatch({ ...opts, message, type: 'error' });
  },
  info: (message: string, opts?: ShortOpts) =>
    dispatch({ ...opts, message, type: 'info' }),
  warning: (message: string, opts?: ShortOpts) => {
    noteTrouble();
    dispatch({ ...opts, message, type: 'warning' });
  },
};
