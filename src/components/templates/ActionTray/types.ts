import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

export interface ActionTrayProps {
  children?: ReactNode;
  maxHeight?: number;
  style?: StyleProp<ViewStyle>;
  onClose?: () => void;
  onOpen?: () => void;
  title?: string;
  showCloseButton?: boolean;
  enableBackdrop?: boolean;
  enableGestures?: boolean;
}

export interface ActionTrayRef {
  open: () => void;
  close: () => void;
  isActive: () => boolean;
  toggle: () => void;
}

export interface BackdropProps {
  onTap: () => void;
  isActive: SharedValue<boolean>;
  opacity?: number;
}

export interface ActionTrayContentProps {
  children: ReactNode;
  title?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
}

export interface UseActionTrayProps {
  maxHeight: number;
  onClose?: () => void;
  onOpen?: () => void;
}

export interface UseActionTrayReturn {
  translateY: SharedValue<number>;
  active: SharedValue<boolean>;
  touchable: boolean;
  scrollTo: (destination: number) => void;
  open: () => void;
  close: () => void;
  isActive: () => boolean;
  toggle: () => void;
}