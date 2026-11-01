import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '#/store/deviceStorage';
import { hydrateWhenStarted } from '#store/persistedStores';
import { registerSessionScopedStore } from '#store/sessionScopedStores';
import { isRecord } from '#/utils/isRecord';

/** Older entries go first: a row's recipe opens from its name until reopened. */
const MAX_KEPT = 500;

interface OpenedCatalogRecipesState {
  /** The API's id for each catalog recipe opened here, by `openedKey`. */
  recipeIds: Record<string, string>;
}

const openedKey = (hit: { provider: string; externalId: string }) =>
  `${hit.provider}:${hit.externalId}`;

const storedIds = (persisted: unknown): Record<string, string> =>
  isRecord(persisted) && isRecord(persisted.recipeIds)
    ? Object.fromEntries(
        Object.entries(persisted.recipeIds).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};

/**
 * Opening a catalog recipe needs the API, so this is how a row opened before
 * finds the recipe the device holds when the API cannot be reached.
 * @internal Test seam: the session-end classification asks the store itself.
 */
export const useOpenedCatalogRecipesStore = create<OpenedCatalogRecipesState>()(
  persist(() => ({ recipeIds: {} }), {
    name: 'sous-chef-opened-catalog-recipes',
    storage: createJSONStorage(() => zustandStorage),
    skipHydration: true,
    version: 1,
    // A recipe opened before hydration finished is newer than the disk's.
    merge: (persisted, current) => ({
      recipeIds: { ...storedIds(persisted), ...current.recipeIds },
    }),
  }),
);

hydrateWhenStarted(useOpenedCatalogRecipesStore);

registerSessionScopedStore('openedCatalogRecipes', () =>
  useOpenedCatalogRecipesStore.setState({ recipeIds: {} }),
);

export function recordOpenedCatalogRecipe(
  hit: { provider: string; externalId: string },
  recipeId: string,
): void {
  const key = openedKey(hit);
  useOpenedCatalogRecipesStore.setState(({ recipeIds }) => {
    const { [key]: _replaced, ...others } = recipeIds;
    const kept = Object.entries(others).slice(1 - MAX_KEPT);
    return { recipeIds: { ...Object.fromEntries(kept), [key]: recipeId } };
  });
}

export const useOpenedRecipeId = (
  hit: { provider: string; externalId: string } | undefined,
): string | undefined =>
  useOpenedCatalogRecipesStore(state =>
    hit ? state.recipeIds[openedKey(hit)] : undefined,
  );
