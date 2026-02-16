import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

/**
 * Visual variant for the card
 */
export type CardVariant = 'normal' | 'warning' | 'expired' | 'success' | 'dimmed';

/**
 * Props for the BaseItemCard component
 */
export interface BaseItemCardProps {
  // Layout slots
  /** Left element (image, emoji, icon) */
  leftElement?: React.ReactNode;
  /** Main content area */
  children?: React.ReactNode;
  /** Right element (meta info, counter, drag handle) */
  rightElement?: React.ReactNode;

  // Styling
  /** Visual variant affecting background and border colors */
  variant?: CardVariant;
  /** Additional container styles */
  containerStyle?: StyleProp<ViewStyle>;

  // Press handler
  /** Callback when card is pressed */
  onPress?: () => void;

  // Swipe actions (all optional - only renders if provided)
  /** Edit action handler */
  onEdit?: () => void;
  /** Delete action handler */
  onDelete?: () => void;
  /** Consume action handler (pantry) */
  onConsume?: () => void;
  /** Waste action handler (pantry) */
  onWaste?: () => void;
  /** Restock action handler (pantry) */
  onRestock?: () => void;
  /** Toggle purchase action handler (shopping list) */
  onTogglePurchase?: () => void;

  // Swipeable coordination
  /** Callback when swipeable begins to open */
  onSwipeableWillOpen?: (ref: React.RefObject<any>) => void;
  /** Callback when swipeable closes */
  onSwipeableClose?: () => void;

  // State
  /** Whether item is purchased (for shopping list strikethrough) */
  isPurchased?: boolean;

  // Swipe configuration
  /** Left swipe threshold in pixels */
  leftThreshold?: number;
  /** Right swipe threshold in pixels */
  rightThreshold?: number;

  // Accessibility
  /** Test ID prefix */
  testID?: string;
}

/**
 * Props for CardLeftSlot component
 */
export interface CardLeftSlotProps {
  /** Type of content to render */
  type: 'emoji' | 'image' | 'icon' | 'custom';
  /** Emoji character (for type='emoji') */
  emoji?: string;
  /** Image URL (for type='image') */
  imageUrl?: string | null;
  /** Icon name (for type='icon') */
  icon?: string;
  /** Icon library (for type='icon') */
  iconLibrary?: 'MaterialIcons' | 'MaterialDesignIcons' | 'Ionicons' | 'Feather';
  /** Background color override */
  backgroundColor?: string;
  /** Card variant for dynamic styling */
  variant?: CardVariant;
  /** Whether to dim the content (purchased state) */
  dimmed?: boolean;
  /** Custom content (for type='custom') */
  children?: React.ReactNode;
}

/**
 * Props for CardContent component
 */
export interface CardContentProps {
  /** Primary title text */
  title: string;
  /** Secondary subtitle (string or custom element) */
  subtitle?: string | React.ReactNode;
  /** Whether item is purchased (for strikethrough styling) */
  isPurchased?: boolean;
  /** Additional title styles */
  titleStyle?: StyleProp<ViewStyle>;
}

/**
 * Props for CardRightSlot component
 */
export interface CardRightSlotProps {
  /** Type of content to render */
  type: 'meta' | 'counter' | 'dragHandle' | 'custom';
  /** Primary text (for type='meta') */
  primary?: string;
  /** Secondary text (for type='meta') */
  secondary?: string;
  /** Tertiary text (for type='meta') */
  tertiary?: string;
  /** Current quantity (for type='counter') */
  quantity?: number;
  /** Unit label (for type='counter') */
  unit?: string;
  /** Increment callback (for type='counter') */
  onIncrement?: () => void;
  /** Decrement callback (for type='counter') */
  onDecrement?: () => void;
  /** Whether counter is disabled (for type='counter') */
  disabled?: boolean;
  /** Drag callback (for type='dragHandle') */
  onDrag?: () => void;
  /** Custom content (for type='custom') */
  children?: React.ReactNode;
}
