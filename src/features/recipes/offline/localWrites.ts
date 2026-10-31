/**
 * What each recipe write changes on the device, as a pending layer. The server's
 * answer writes its own rows; `commit` adds what it cannot state.
 */
import type { LocalWrite } from '#/apollo/pendingWrites/types';
import { writeEntityFields } from '#/apollo/utils/localFirstFields';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import type { CreateRecipeInput } from '#/graphql/generated/schemaTypes';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import {
  dropFavorite,
  linkSavedFavorite,
  offerSavedFolder,
  writeLocalFavorite,
  type SaveToFavoritesOptions,
} from '#features/recipes/cache/favorites';
import { moveSavedFolder } from '#features/recipes/cache/folders';
import {
  removeMyRecipesEdge,
  upsertMyRecipesEdge,
  writeLocalRecipe,
  type RecipeCreatedBy,
} from '#features/recipes/utils/recipeCacheWriters';

export type CreateRecipeInputs = {
  id: string;
  /** What the device shows; a fork's copy, which only the server makes. */
  recipe: CreateRecipeInput;
  createdBy: RecipeCreatedBy;
  ingredientIds: string[];
};

export const createRecipe: LocalWrite<CreateRecipeInputs> = {
  apply(cache, { inputs: { id, recipe, createdBy, ingredientIds } }) {
    writeLocalRecipe(cache, id, recipe, createdBy, ingredientIds);
  },
  commit(cache, { inputs: { id } }) {
    upsertMyRecipesEdge(cache, { __typename: 'Recipe', id });
  },
};

export type RemoveRecipeInputs = { recipeId: string };

const leaveMyRecipes: LocalWrite<RemoveRecipeInputs>['apply'] = (
  cache,
  { inputs },
) => {
  removeMyRecipesEdge(cache, inputs.recipeId);
};

export const removeRecipe: LocalWrite<RemoveRecipeInputs> = {
  apply: leaveMyRecipes,
  // The answer names the row, not the lists it left.
  commit: leaveMyRecipes,
};

export type AddFavoriteInputs = {
  savedRecipeId: string;
  recipeId: string;
  options: SaveToFavoritesOptions;
  now: string;
};

export const addFavorite: LocalWrite<AddFavoriteInputs> = {
  apply(cache, { inputs: { savedRecipeId, recipeId, options, now } }) {
    writeLocalFavorite(cache, savedRecipeId, recipeId, options, now);
  },
  // The server may converge the save on the row the user already has.
  commit(cache, { inputs: { savedRecipeId } }, data) {
    const payload: unknown = appliedPayload(data);
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
      savedRecipeId,
    );
  },
};

export type RemoveFavoriteInputs = { recipeId: string };

const leaveFavorites: LocalWrite<RemoveFavoriteInputs>['apply'] = (
  cache,
  { inputs },
) => {
  dropFavorite(cache, inputs.recipeId);
};

export const removeFavorite: LocalWrite<RemoveFavoriteInputs> = {
  apply: leaveFavorites,
  // The answer states the recipe's `savedDetails`, not the list it left.
  commit: leaveFavorites,
};

export type SavedFieldsInputs = {
  /** Absent when the cache holds no saved row: the server still takes the edit. */
  savedRecipeId?: string;
  fields: Readonly<Record<string, unknown>>;
};

export const savedFields: LocalWrite<SavedFieldsInputs> = {
  apply(cache, { inputs: { savedRecipeId, fields } }) {
    if (!savedRecipeId) return;
    const row = { __typename: 'SavedRecipe', id: savedRecipeId };
    if (isHeld(cache, row)) writeEntityFields(cache, row, fields);
  },
  commit(cache, _write, data) {
    const payload: unknown = appliedPayload(data);
    const saved = isRecord(payload) ? payload.savedRecipe : undefined;
    if (isRecord(saved) && typeof saved.folder === 'string' && saved.folder) {
      offerSavedFolder(cache, saved.folder);
    }
  },
};

export type MoveFolderInputs = { folder: string; moveTo: string | null };

const moveFolderRows: LocalWrite<MoveFolderInputs>['apply'] = (
  cache,
  { inputs },
) => {
  moveSavedFolder(cache, inputs.folder, inputs.moveTo);
};

export const moveFolder: LocalWrite<MoveFolderInputs> = {
  apply: moveFolderRows,
  // The answer states only the folder's name and how many recipes moved.
  commit: moveFolderRows,
};
