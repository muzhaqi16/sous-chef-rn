import type { SwipeAction } from './types';

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
