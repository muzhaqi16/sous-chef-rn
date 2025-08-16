import {MaterialIconName} from '#/types';

export interface SwipeableItemProps {
  children: React.ReactNode;
  onPress?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  enableSwipeToDelete?: boolean;
  leftThreshold?: number;
  rightThreshold?: number;
  friction?: number;
}

export interface ActionButtonProps {
  onPress: () => void;
  icon: MaterialIconName;
  backgroundColor: string;
  label?: string;
}

export interface SwipeActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onActionPress: (action: 'edit' | 'delete') => void;
}
