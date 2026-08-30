import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import type { SwipeableRef, SwipeAction } from '../SwipeableItem/types';

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
  type: 'emoji' | 'image' | 'icon' | 'custom';
  /** For type='emoji'. */
  emoji?: string;
  /** For type='image'. */
  imageUrl?: string | null;
  /** For type='icon'. */
  icon?: string;
  iconLibrary?: string;
  backgroundColor?: string;
  variant?: CardVariant;
  dimmed?: boolean;
  /** For type='custom'. */
  children?: React.ReactNode;
}

export interface CardContentProps {
  title: string;
  subtitle?: string | React.ReactNode;
  /** Drives strikethrough styling. */
  isPurchased?: boolean;
  titleStyle?: StyleProp<ViewStyle>;
}

export interface CardRightSlotProps {
  type: 'meta' | 'counter' | 'dragHandle' | 'custom';
  /**
   * testID for the PRIMARY value (type='meta') — the item's quantity, which a
   * parsing test must read back without going through locale-dependent text.
   */
  testID?: string;
  /** For type='meta'. */
  primary?: string;
  secondary?: string;
  tertiary?: string;
  /** For type='counter'. */
  quantity?: number;
  unit?: string;
  onIncrement?: () => void;
  onDecrement?: () => void;
  disabled?: boolean;
  /** For type='dragHandle'. */
  onDrag?: () => void;
  /** For type='custom'. */
  children?: React.ReactNode;
}
