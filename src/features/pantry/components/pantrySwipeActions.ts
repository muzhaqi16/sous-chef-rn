import {
  deleteAction,
  editAction,
} from '#components/molecules/SwipeableItem/commonActions';
import type { SwipeAction } from '#components/molecules/SwipeableItem/types';

/**
 * The pantry's swipe vocabulary.
 *
 * Left: consume / record waste / restock. Right: edit / delete. These verbs
 * used to be named props on `SwipeableItem`, `BaseItemCard`, `ItemCard` and
 * `ItemList`, with their icons hardcoded in the shared swipe components — so
 * the pantry's vocabulary was spelled out in four kit files. It lives here now.
 *
 * `haptic: false` on the three left actions preserves existing behaviour: only
 * edit, delete and toggle-purchase have ever buzzed.
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
