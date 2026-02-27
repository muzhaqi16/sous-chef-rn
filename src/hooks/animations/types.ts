import { type SharedValue, type withTiming, type useAnimatedStyle } from 'react-native-reanimated';

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

// Slide Animation Types
export type SlideDirection = 1 | -1; // 1 = right, -1 = left
export type AllowedDirections = 'left' | 'right' | 'both';

/**
 * Configuration for slide animations.
 * Can be used with SLIDE_PRESETS or custom values.
 */
export interface SlideAnimationConfig {
  /** Distance to slide in pixels, or 'screenWidth' for full-width exit */
  slideDistance: number | 'screenWidth';
  /** Animation duration in ms (default: 200) */
  duration?: number;
  /** Custom easing function (default: standard cubic bezier) */
  easing?: Parameters<typeof withTiming>[1] extends { easing?: infer E } ? E : never;
  /** Enable opacity fade during slide (default: false) */
  withOpacity?: boolean;
  /** Final opacity value when withOpacity is true (default: 0) */
  opacityTarget?: number;
  /** Restrict slide direction (default: 'both') */
  allowedDirections?: AllowedDirections;
}

export interface UseSlideAnimationOptions extends Omit<SlideAnimationConfig, 'slideDistance'> {
  /** Item ID for FlashList view recycling detection */
  itemId: string;
  /** Distance to slide in pixels (default: 50) */
  slideDistance?: number;
  /** Disable animation entirely (default: false) */
  disabled?: boolean;
}

export interface UseSlideAnimationReturn {
  /** Animated style to apply to the container */
  animatedSlideStyle: ReturnType<typeof useAnimatedStyle>;
  /** Trigger the slide animation. direction: 1 = right, -1 = left. onComplete called after animation finishes. */
  triggerSlide: (direction: SlideDirection, onComplete?: () => void) => void;
  /** Reset slide position to origin */
  resetSlide: () => void;
  /** Whether animation is currently in progress */
  isAnimating: SharedValue<boolean>;
}
