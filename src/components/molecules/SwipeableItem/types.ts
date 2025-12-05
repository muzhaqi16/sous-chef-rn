import {Icon} from '#/utils/iconUtils';

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
  failOffsetY?: number | [number, number];
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  testIDPrefix?: string;
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
}
