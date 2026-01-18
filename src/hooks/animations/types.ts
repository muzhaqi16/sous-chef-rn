import type { SharedValue } from 'react-native-reanimated';

export interface SpringConfig {
  mass?: number;
  damping?: number;
  stiffness?: number;
}

export interface AnimatedPresenceCallbacks {
  onOpenStart?: () => void;
  onOpenComplete?: () => void;
  onCloseStart?: () => void;
  onCloseComplete?: () => void;
}

export interface UseAnimatedPresenceProps {
  springConfig?: SpringConfig;
  skipInitialAnimation?: boolean;
  callbacks?: AnimatedPresenceCallbacks;
  initialVisible?: boolean;
}

export interface UseAnimatedPresenceReturn {
  shouldRender: boolean;
  isVisible: SharedValue<boolean>;
  progress: SharedValue<number>;
  open: () => void;
  close: () => void;
  toggle: () => void;
  isActive: () => boolean;
}
