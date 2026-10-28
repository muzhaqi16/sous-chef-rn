/**
 * What the core asks a host to present. The host's mounted toast region and
 * dialog host register a presenter; the core never renders.
 */

export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  /** A smaller second line under `message`, which then reads as a short title. */
  detail?: string;
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

const NOTICE_MS = 1000;
// About 240 words a minute.
const MS_PER_WORD = 250;
const ACTION_REACH_MS = 1500;
const MIN_HOLD_MS = 1400;
const MAX_HOLD_MS = 8000;

/**
 * How long a toast holds, in ms: a beat to notice it, then time to read every
 * word it shows, and to reach its action. Armed on the tick its enter
 * animation starts, so it spans the fade-in.
 */
export function toastHoldMs({ message, detail, action }: ToastOptions): number {
  const words = [message, detail, action?.label]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  const hold = NOTICE_MS + words * MS_PER_WORD + (action ? ACTION_REACH_MS : 0);
  return Math.min(Math.max(hold, MIN_HOLD_MS), MAX_HOLD_MS);
}

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
