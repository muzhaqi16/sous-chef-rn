import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { BarAction } from '#components/molecules/BarActions';

export interface ActionTrayProps {
  /** Presents the tray; false takes it away, animating out. */
  visible: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Every close: the header's, the backdrop's, Back, a drag, or navigation. */
  onDismiss: () => void;
  onOpen?: () => void;
  title?: string;
  /** Actions beside the title, icon or text; the close control follows them. */
  headerActions?: BarAction[];
  /**
   * Optional content pinned to the bottom of the tray (e.g. primary actions).
   * Rendered via gorhom's `footerComponent`, so it stays fixed while the body
   * scrolls. Put scrolling content in `children`, not here.
   */
  footer?: ReactNode;
  showCloseButton?: boolean;
  enableBackdrop?: boolean;
  /**
   * Set `'push'` when this tray opens from INSIDE another bottom sheet.
   * gorhom's default `'switch'` minimizes the host sheet, which reads as a
   * crash. Left undefined outside a sheet so the dismiss-dedupe above keeps
   * handling the `onChange(-1)`-without-`onDismiss` case that 'switch' emits.
   */
  stackBehavior?: 'push' | 'switch' | 'replace';
}
