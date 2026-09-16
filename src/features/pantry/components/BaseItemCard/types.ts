import type React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type {
  SwipeableRef,
  SwipeAction,
} from '#components/organisms/SwipeableItem/types';

export type CardVariant =
  | 'normal'
  | 'warning'
  | 'expired'
  | 'success'
  | 'dimmed';

export interface BaseItemCardProps {
  /** Left element (image, emoji, icon). */
  leftElement?: React.ReactNode;
  children?: React.ReactNode;
  /** Right element (meta info, counter, drag handle). */
  rightElement?: React.ReactNode;

  variant?: CardVariant;
  containerStyle?: StyleProp<ViewStyle>;

  onPress?: () => void;

  // Descriptors, not named handlers: which verbs a row offers is the caller's.
  /** Revealed by swiping right. */
  leftActions?: SwipeAction[];
  /** Revealed by swiping left. */
  rightActions?: SwipeAction[];

  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onSwipeableClose?: () => void;

  /** Left swipe threshold, px. */
  leftThreshold?: number;
  /** Right swipe threshold, px. */
  rightThreshold?: number;

  /** Drives the FlashList recycling reset. */
  itemId?: string;

  testID?: string;
}

export interface CardLeftSlotProps {
  imageUrl?: string | null;
}

export interface CardContentProps {
  title: string;
  subtitle?: string | React.ReactNode;
  /** Drives strikethrough styling. */
  isPurchased?: boolean;
  titleStyle?: StyleProp<ViewStyle>;
}

export interface CardRightSlotProps {
  /**
   * testID for the PRIMARY value — the item's quantity, which a parsing test
   * must read back without going through locale-dependent text.
   */
  testID?: string;
  primary?: string;
  secondary?: string;
}
