import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface ActionTrayProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onClose?: () => void;
  onOpen?: () => void;
  title?: string;
  showCloseButton?: boolean;
  enableBackdrop?: boolean;
}

export interface ActionTrayRef {
  open: () => void;
  close: () => void;
  isActive: () => boolean;
  toggle: () => void;
}

export interface ActionTrayContentProps {
  children: ReactNode;
  title?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
}
