import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface ActionTrayProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onClose?: () => void;
  onOpen?: () => void;
  title?: string;
  headerRight?: ReactNode;
  /**
   * Optional content pinned to the bottom of the tray (e.g. primary actions).
   * Rendered via gorhom's `footerComponent`, so it stays fixed while the body
   * scrolls. Put scrolling content in `children`, not here.
   */
  footer?: ReactNode;
  showCloseButton?: boolean;
  enableBackdrop?: boolean;
}

export interface ActionTrayRef {
  open: () => void;
  close: () => void;
  isActive: () => boolean;
  toggle: () => void;
}
