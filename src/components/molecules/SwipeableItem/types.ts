import type { SharedValue } from 'react-native-reanimated';
import { Icon } from '#/utils/iconUtils';

/**
 * Swipe mode controls the behavior of swipe actions:
 * - 'shopping': Left swipe = Edit, Right swipe = Delete (checkbox handles purchase toggle)
 * - 'pantry': Left swipe = Consume/Waste/Restock, Right swipe = Edit + Delete
 * - undefined/default: Original behavior based on provided callbacks
 */
export type SwipeMode = 'shopping' | 'pantry';

export interface SwipeableItemProps {
  children: React.ReactNode;
  /** Item ID for FlashList recycling reset — closes swipeable when cell is reused */
  itemId?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onTogglePurchase?: () => void;
  onConsume?: () => void;
  onWaste?: () => void;
  onRestock?: () => void;
  isPurchased?: boolean;

  leftThreshold?: number;
  rightThreshold?: number;
  friction?: number;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  testIDPrefix?: string;
  /** Controls swipe action layout - 'shopping' puts edit on left, 'pantry' uses original layout */
  swipeMode?: SwipeMode;
  /** Disables swipe gestures when false (e.g. during tutorial spotlight steps) */
  enabled?: boolean;
}

export interface ActionButtonProps {
  onPress: () => void;
  icon: React.ComponentProps<typeof Icon>['name'];
  /** @deprecated The button is rendered as an outlined circle; backgroundColor is ignored. */
  backgroundColor?: string;
  label?: string;
  circular?: boolean;
  library?: string;
  testID?: string;
}

export interface SwipeActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePurchase?: () => void;
  onConsume?: () => void;
  onWaste?: () => void;
  onRestock?: () => void;
  isPurchased?: boolean;
  onActionPress?: (action: 'edit' | 'delete') => void;
  swipeableRef?: React.RefObject<any>;
  testIDPrefix?: string;
  progress?: SharedValue<number>;
  /** Controls swipe action layout */
  swipeMode?: SwipeMode;
}
