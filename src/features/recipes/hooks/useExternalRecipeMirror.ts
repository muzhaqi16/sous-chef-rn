/**
 * Mirrors an external (Spoonacular) recipe into the backend via
 * `upsertExternalRecipe`, returning its backend id for later operations. Never
 * queued: the upsert needs the API, and a caller without it falls back to the
 * id an earlier mirror returned.
 */

import { useState, useRef } from 'react';
import { errorService } from '#/services/errorService';
import { useMutation } from '@apollo/client/react';
import { UpsertExternalRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import type { RecipeInformation } from '#/services/spoonacular/types';
import { fetchRecipePriceBreakdown } from '#features/recipes/store/useRecipeCacheStore';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import { toRecipeInput } from '#features/recipes/utils/toRecipeInput';

/**
 * Represents a recipe that has been preloaded to the backend
 */
export interface PreloadedRecipe {
  /** Backend recipe ID */
  id: string;
  /** Recipe name */
  name: string;
  /** Recipe image URL */
  imageUrl?: string;
  /** Whether this was a newly created recipe (vs found existing) */
  created: boolean;
  /** External source */
  externalSource: ExternalSource;
  /** External ID (Spoonacular ID) */
  externalId: string;
}

export function useExternalRecipeMirror() {
  const { t } = useTranslation();

  const [preloadedRecipe, setPreloadedRecipe] =
    useState<PreloadedRecipe | null>(null);

  // Cache of preloaded recipes (externalId -> PreloadedRecipe)
  const preloadCacheRef = useRef<Map<string, PreloadedRecipe>>(new Map());

  // Track which recipes we've already attempted to preload (to prevent multiple calls)
  const attemptedPreloadsRef = useRef<Set<string>>(new Set());

  const [upsertRecipe] = useMutation(UpsertExternalRecipeDocument);

  /**
   * Find-or-create the app's own recipe behind an external one. Fire-and-forget
   * on a view; a deliberate save re-ingests to attach per-ingredient cost.
   */
  const preloadRecipe = async (
    spoonacularRecipe: RecipeInformation,
    externalSource: ExternalSource = ExternalSource.Spoonacular,
    preloadOptions: { withCost?: boolean } = {},
  ): Promise<PreloadedRecipe | null> => {
    const externalId = String(spoonacularRecipe.id);

    // Fire-and-forget view preloads run once per recipe. A deliberate save
    // (withCost) re-ingests to attach per-ingredient cost even if the view
    // already preloaded without it — the server re-ingest is idempotent and
    // TTL-gated, so this is safe to call again.
    if (
      attemptedPreloadsRef.current.has(externalId) &&
      !preloadOptions.withCost
    ) {
      const cached = preloadCacheRef.current.get(externalId);
      return cached ?? null;
    }
    attemptedPreloadsRef.current.add(externalId);

    // Per-ingredient cost comes from the recipe-scoped priceBreakdown (ONE
    // call), fetched only on deliberate saves. Best-effort — a failure
    // (network/quota) leaves estimatedCost empty rather than blocking the save.
    let priceBreakdown = null;
    if (preloadOptions.withCost) {
      try {
        priceBreakdown = await fetchRecipePriceBreakdown(Number(externalId));
      } catch (error) {
        // Best-effort: leaving it null lets the save proceed without cost.
        errorService.reportError(error, {
          operation: 'preloadRecipe: fetch price breakdown',
        });
      }
    }

    const input = toRecipeInput(spoonacularRecipe, priceBreakdown);

    // Reported, not shown: a view preload is invisible, and a deliberate save
    // reports its own outcome when no backend id comes back.
    const settled = await settleMutation(
      () => upsertRecipe({ variables: { input } }),
      {
        document: UpsertExternalRecipeDocument,
        fallback: t('recipes.saveRecipeFailed'),
        present: 'none',
      },
    );

    const payload = appliedPayload(settled.data);
    if (payload) {
      const data = payload;
      const preloaded: PreloadedRecipe = {
        id: data.recipe.id,
        name: data.recipe.name,
        imageUrl: data.recipe.imageUrl ?? undefined,
        created: data.created,
        externalSource,
        externalId,
      };

      preloadCacheRef.current.set(externalId, preloaded);
      setPreloadedRecipe(preloaded);

      return preloaded;
    }

    return null;
  };

  /** The backend id an earlier mirror of this external recipe returned. */
  const mirroredRecipeId = (externalId: string): string | undefined =>
    preloadCacheRef.current.get(externalId)?.id;

  return { preloadedRecipe, preloadRecipe, mirroredRecipeId };
}
