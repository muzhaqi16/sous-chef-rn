import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';

/** Drops a collaborator from a list's cached `collaboratorsConnection`. */
export const removeCollaboratorFromShoppingListCache =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'collaboratorsConnection',
    'ShoppingListCollaborator',
  );
