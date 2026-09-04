import type {
  SwipeAction,
  ItemSwipeActionsFactory,
} from '#components/organisms/SwipeableItem/types';

/**
 * The two row actions that are not domain-specific. Anything naming a domain verb
 * (consume, restock, mark purchased) is built by the feature owning it. `testID`
 * is left unset so `SwipeableItem` can fill it from its `testIDPrefix`.
 */
export const editAction = (onPress: () => void): SwipeAction => ({
  key: 'edit',
  icon: 'create-outline',
  labelKey: 'labels.edit',
  onPress,
});

export const deleteAction = (onPress: () => void): SwipeAction => ({
  key: 'delete',
  icon: 'trash-outline',
  labelKey: 'labels.delete',
  onPress,
});

/**
 * Resolves one row's swipe actions, notifying the list before a row-removing one
 * runs — `SwipeableItem` ignores `removesRow` by design. Called from the ROW: in
 * the list it would pass a closure over the FlashList ref into a call during
 * render, which the React Compiler refuses.
 */
export function resolveRowActions(
  itemSwipeActions: ItemSwipeActionsFactory | undefined,
  id: string,
  onRemoving: (() => void) | undefined,
): { left?: SwipeAction[]; right?: SwipeAction[] } | undefined {
  const built = itemSwipeActions?.(id);
  if (!built) return undefined;

  const prepare = (list: SwipeAction[] | undefined) =>
    list?.map(action =>
      action.removesRow
        ? {
            ...action,
            onPress: () => {
              onRemoving?.();
              action.onPress();
            },
          }
        : action,
    );

  return { left: prepare(built.left), right: prepare(built.right) };
}
