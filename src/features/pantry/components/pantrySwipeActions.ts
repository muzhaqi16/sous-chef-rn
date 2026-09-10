import {
  deleteAction,
  editAction,
} from '#components/organisms/SwipeableItem/commonActions';
import type { SwipeAction } from '#components/organisms/SwipeableItem/types';

/**
 * The pantry's swipe vocabulary — left: consume / waste / restock, right:
 * edit / delete. Domain verbs belong to the feature, not the kit's swipe
 * components. `haptic: false` on the left three: each opens its own sheet,
 * which buzzes on its outcome, so only edit and delete buzz on the swipe.
 */
export const pantrySwipeActions = ({
  onConsume,
  onWaste,
  onRestock,
  onEdit,
  onDelete,
}: {
  onConsume?: () => void;
  onWaste?: () => void;
  onRestock?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}): { left: SwipeAction[]; right: SwipeAction[] } => {
  const left: SwipeAction[] = [];
  if (onConsume)
    left.push({
      key: 'consume',
      icon: 'restaurant-outline',
      labelKey: 'swipeActions.consume',
      onPress: onConsume,
      haptic: false,
      removesRow: true,
    });
  if (onWaste)
    left.push({
      key: 'waste',
      icon: 'warning-outline',
      labelKey: 'swipeActions.recordWaste',
      onPress: onWaste,
      haptic: false,
      removesRow: true,
    });
  if (onRestock)
    left.push({
      key: 'restock',
      icon: 'add-circle-outline',
      labelKey: 'swipeActions.restock',
      onPress: onRestock,
      haptic: false,
    });

  const right: SwipeAction[] = [];
  if (onEdit) right.push(editAction(onEdit));
  if (onDelete) right.push({ ...deleteAction(onDelete), removesRow: true });

  return { left, right };
};
