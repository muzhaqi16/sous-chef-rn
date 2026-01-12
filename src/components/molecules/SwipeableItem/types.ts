import type { SharedValue } from 'react-native-reanimated';
import {Icon} from '#/utils/iconUtils';

/**
 * Swipe mode controls the behavior of swipe actions:
 * - 'shopping': Left swipe = Edit, Right swipe = Delete (checkbox handles purchase toggle)
 * - 'pantry': Left swipe = Consume/Waste/Restock, Right swipe = Edit + Delete
 * - undefined/default: Original behavior based on provided callbacks
 */
export type SwipeMode = 'shopping' | 'pantry';

export interface SwipeableItemProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onTogglePurchase?: () => void;
  onConsume?: () => void;
  onWaste?: () => void;
  onRestock?: () => void;
  isPurchased?: boolean;
  enableSwipeToDelete?: boolean;
  leftThreshold?: number;
  rightThreshold?: number;
  friction?: number;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  testIDPrefix?: string;
  /** Controls swipe action layout - 'shopping' puts edit on left, 'pantry' uses original layout */
  swipeMode?: SwipeMode;
}

export interface ActionButtonProps {
  onPress: () => void;
  icon: React.ComponentProps<typeof Icon>['name'];
  backgroundColor: string;
  label?: string;
  circular?: boolean;
  library?: 'MaterialIcons' | 'MaterialDesignIcons' | 'Ionicons' | 'Feather';
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
