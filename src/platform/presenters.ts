/**
 * What the core asks a host to present. The host's mounted toast region and
 * dialog host register a presenter; the core never renders.
 */

export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  /**
   * Hold in ms, default `TOAST.AUTO_DISMISS_SHORT`. Prefer a `TOAST` preset. The
   * hold spans the fade-in and excludes the fade-out, so time on screen is about
   * `duration + motion.timing.STANDARD`.
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
}

export interface AlertEntry {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

export type AlertPresenter = (entry: AlertEntry) => void;
