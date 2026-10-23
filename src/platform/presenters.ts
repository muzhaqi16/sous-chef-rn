/**
 * What the core asks a host to present. The host's mounted toast region and
 * dialog host register a presenter; the core never renders.
 */

export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';

/**
 * How long a toast holds, in ms. Armed on the tick its enter animation starts,
 * so it spans the fade-in; add `motion.timing.STANDARD` for time on screen.
 */
export const TOAST_HOLD_MS = {
  /** The default: a confirmation. */
  SHORT: 1400,
  /** A full sentence rather than a confirmation: reading time. */
  LONG: 2600,
};

export interface ToastOptions {
  message: string;
  /**
   * Hold in ms, default `TOAST_HOLD_MS.SHORT`; prefer a `TOAST_HOLD_MS` preset.
   * The hold spans the fade-in and excludes the fade-out, so time on screen is
   * about `duration + motion.timing.STANDARD`.
   */
  duration?: number;
  type?: ToastType;
  action?: { label: string; onPress: () => void };
  /**
   * A toast replaces a displayed or queued one of its own type, `action` and
   * all. This marks a state announcement, which also replaces an announcement
   * of another type: only the latest state is still true.
   */
  supersede?: boolean;
}

export type ToastPresenter = (options: ToastOptions) => void;

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  style?: AlertButtonStyle;
  onPress?: () => void;
  /** `onPress` waits until the dialog has left the screen: for an action that
   *  presents native UI, which iOS would present from the dialog's own modal. */
  afterClose?: boolean;
}

export interface AlertEntry {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

export type AlertPresenter = (entry: AlertEntry) => void;
