import type { SwipeAction, ItemSwipeActionsFactory } from './types';

/**
 * The two row actions that are not domain-specific.
 *
 * Edit and delete mean the same thing on any list in any app, so they get
 * builders here; anything that names a domain verb (consume, restock, mark
 * purchased) is built by the feature that owns that verb.
 *
 * `testID` is left unset — `SwipeableItem` fills it from its `testIDPrefix`,
 * which is how `pantry-item-<id>-edit` keeps working without every call site
 * threading the prefix through.
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
 * Resolve one row's swipe actions, telling the list before a row-removing one runs.
 *
 * `SwipeableItem` deliberately ignores `removesRow` — the swipe molecule has no
 * opinion about the list around it — so the list is what honours it, and every
 * list has to honour it the same way. It was implemented twice, and the copies
 * had already diverged: one also fired the caller's pre-removal hook and the
 * other silently dropped it.
 *
 * Called from the ROW rather than the list, and `onRemoving` arrives as a
 * command from the actions bag. Building the wrapper in the list instead means
 * passing a closure over the list's FlashList ref into a call during render,
 * which the React Compiler refuses to compile ("Cannot access refs during
 * render") — it cannot know the callee will not invoke it immediately.
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
