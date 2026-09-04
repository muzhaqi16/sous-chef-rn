import { Platform } from 'react-native';
import type { ScrollViewProps } from 'react-native';

/**
 * Measured on an SM-S908U1 (Android 16): with `handled`, a tap on a control
 * inside a scroll host is still spent dismissing the keyboard, so the control
 * never fires. `always` delivers it. iOS honours `handled`, and keeping it
 * there preserves dismiss-on-background-tap where it works.
 */
export const KEYBOARD_PERSIST_TAPS: ScrollViewProps['keyboardShouldPersistTaps'] =
  Platform.select({ android: 'always', default: 'handled' });

/** Android loses dismiss-on-background-tap above; dragging still dismisses. */
export const KEYBOARD_DISMISS_MODE: ScrollViewProps['keyboardDismissMode'] =
  'on-drag';
