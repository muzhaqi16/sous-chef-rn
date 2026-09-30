/**
 * Settling a recipe replay the server accepted, possibly onto a different row
 * than the one minted locally.
 */
import { linkSavedFavorite } from '#features/recipes/cache/favorites';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';
import { isRecord } from '#/utils/isRecord';

/**
 * A queued save replays as itself, and the server converges it on the saved
 * row the user already has; the replay settles it as the foreground does.
 */
export const reconcileAddRecipeToFavoritesReplay: ReplayReconcilerTable[string] =
  (cache, variables, data) => {
    const input: unknown = variables.input;
    const clientId =
      isRecord(input) && typeof input.id === 'string' ? input.id : null;

    const payload: unknown = extractMutationPayload(data);
    const saved = isRecord(payload) ? payload.savedRecipe : undefined;
    if (
      !isRecord(saved) ||
      typeof saved.id !== 'string' ||
      typeof saved.recipeId !== 'string'
    ) {
      return;
    }
    linkSavedFavorite(
      cache,
      {
        id: saved.id,
        recipeId: saved.recipeId,
        folder: typeof saved.folder === 'string' ? saved.folder : null,
      },
      clientId,
    );
  };
