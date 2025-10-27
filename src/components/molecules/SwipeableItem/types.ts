import {Icon} from '#/utils/iconUtils';

export interface SwipeableItemProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onTogglePurchase?: () => void;
  isPurchased?: boolean;
  enableSwipeToDelete?: boolean;
  leftThreshold?: number;
  rightThreshold?: number;
  friction?: number;
  onSwipeableWillOpen?: (ref: any) => void;
}

export interface ActionButtonProps {
  onPress: () => void;
  icon: React.ComponentProps<typeof Icon>['name'];
  backgroundColor: string;
  label?: string;
  circular?: boolean;
  library?: 'MaterialIcons' | 'MaterialDesignIcons' | 'Ionicons' | 'Feather';
}

export interface SwipeActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePurchase?: () => void;
  isPurchased?: boolean;
  onActionPress?: (action: 'edit' | 'delete') => void;
  swipeableRef?: React.RefObject<any>;
}
