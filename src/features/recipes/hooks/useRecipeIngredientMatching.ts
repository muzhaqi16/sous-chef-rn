import { useState } from 'react';
import { useTranslation } from '#/i18n';
import {
  useApolloClient,
  useLazyQuery,
  useMutation,
} from '@apollo/client/react';
import {
  MatchRecipeIngredientsToPantryDocument,
  MarkRecipeAsCookedDocument,
  type MatchRecipeIngredientsToPantryQuery,
} from '#features/recipes/graphql/recipe.generated';
import {
  RecipeIngredientFragmentDoc,
  type RecipeIngredientFragment,
} from '#features/recipes/graphql/recipeFragments.generated';
import {
  RecipeIngredientMatchKind,
  type IngredientUsageInput,
} from '#/graphql/generated/schemaTypes';
import { useSelectedHomeId, useSelectedPantryId } from '#store/useAppStore';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';
import {
  RecipeSubstitutesDocument,
  type RecipeSubstitutesQuery,
} from './useRecipeSubstitutes.generated';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { logger } from '#/utils/environment';
import { errorService } from '#/services/errorService';

type IngredientMatch =
  MatchRecipeIngredientsToPantryQuery['matchRecipeIngredientsToPantry'][number];

/** What the cook entered before the review: the cooking log records it. */
export interface CookEntry {
  servings: number;
  notes?: string;
}

export type PantryStackOption = NonNullable<
  IngredientMatch['matchedPantryItem']
>;

type SubstituteOptionData = NonNullable<
  RecipeSubstitutesQuery['recipe']
>['ingredientsConnection']['edges'][number]['node']['substitutes'][number];

/** A swap the cook can use instead of a missing ingredient. */
export interface CookSubstitute {
  id: string;
  /** Its parts, worded for the chip. */
  label: string;
  /** The parts the pantry holds, each drawn from the stack named. */
  parts: {
    key: string;
    text: string;
    stack: PantryStackOption;
    quantity: number;
    unitId: string;
  }[];
  /** Whether the parts are for the recipe's amount, so they scale with it. */
  scaled: boolean;
}

export interface EditableMatch {
  match: IngredientMatch;
  /** Materialized RecipeIngredient fragment (id, isOptional, unit, …). The
   *  match's `ingredient` field is a masked fragment ref; we unmask once
   *  when building the editable so consumers can read fields directly. */
  ingredient: RecipeIngredientFragment;
  /** Every stack that could serve the ingredient, the server's pick first. */
  stackOptions: PantryStackOption[];
  /** The stack the deduction draws on: the server's pick until the user picks. */
  selectedStack: PantryStackOption | null;
  /** Null while the recipe states no amount and the cook has stated none. */
  adjustedQuantity: number | null;
  adjustedUnitId: string | null;
  isIncluded: boolean;
  /** Swaps for an ingredient the pantry does not cover, parts held first. */
  substitutes: CookSubstitute[];
  /** The swap the cook picked; its parts are drawn and the ingredient is not. */
  selectedSubstitute: CookSubstitute | null;
}

export type MatchUpdate = Partial<
  Pick<
    EditableMatch,
    'adjustedQuantity' | 'isIncluded' | 'selectedStack' | 'selectedSubstitute'
  >
>;

export interface MatchSummary {
  total: number;
  available: number;
  partial: number;
  missing: number;
  unsure: number;
  included: number;
}

type AvailabilityStatus = 'available' | 'partial' | 'missing' | 'unsure';

/**
 * `unsure` is a stack found by name only: it is offered, never deducted
 * until the user turns it on. `missing` is no stack, or an empty one.
 */
export function getAvailabilityStatus(
  match: IngredientMatch,
): AvailabilityStatus {
  const stack = match.matchedPantryItem;
  if (!stack) return 'missing';
  if (match.matchKind === RecipeIngredientMatchKind.Name) return 'unsure';
  if (match.isAvailable) return 'available';
  // `availableQuantity` is null when the recipe's unit cannot express the
  // stack (a loaf against a pound), so what the stack holds decides these two.
  if (stack.displayAmount.quantity > 0) return 'partial';
  return 'missing';
}

/**
 * How much of the recipe's amount the cook is making: the suggested amount over
 * the recipe's, where both are in the ingredient's own unit; else as written.
 */
function servingsRatio(
  match: IngredientMatch,
  ingredient: RecipeIngredientFragment,
) {
  const recipeQuantity = ingredient.quantity;
  if (
    !recipeQuantity ||
    match.suggestedQuantity === null ||
    match.suggestedUnit?.id !== ingredient.unit?.id
  ) {
    return 1;
  }
  return match.suggestedQuantity / recipeQuantity;
}

export function useRecipeIngredientMatching(recipeId: string | undefined) {
  const { t } = useTranslation();
  const pantryId = useSelectedPantryId();
  const homeId = useSelectedHomeId();
  const client = useApolloClient();
  const [editableMatches, setEditableMatches] = useState<EditableMatch[]>([]);
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const [loadMatchesQuery] = useLazyQuery(
    MatchRecipeIngredientsToPantryDocument,
    // Matches read current pantry stock, so a reopened flow must ask again;
    // a re-execute otherwise inherits the client's `cache-first`.
    {
      fetchPolicy: 'network-only',
      nextFetchPolicy: 'network-only',
    },
  );

  // Substitutes read the same pantry stock, so a reopened review asks again.
  const [loadSubstitutesQuery] = useLazyQuery(RecipeSubstitutesDocument, {
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'network-only',
  });

  const toCookSubstitute = (
    option: SubstituteOptionData,
  ): CookSubstitute | null => {
    const texts = option.parts.map(part =>
      t('recipes.substitutes.part', {
        amount: [formatQuantityForDisplay(part.quantity), part.unit.symbol]
          .filter(Boolean)
          .join(' '),
        name: part.item.name,
      }),
    );
    const held = option.parts.flatMap((part, index) =>
      part.pantryItem
        ? [
            {
              key: part.item.id,
              text: texts[index] ?? part.item.name,
              stack: part.pantryItem,
              quantity: part.quantity,
              unitId: part.unit.id,
            },
          ]
        : [],
    );
    // A swap the pantry holds none of has nothing to draw.
    if (held.length === 0) return null;
    return {
      id: option.substitute.id,
      label: texts.join(', '),
      parts: held,
      scaled: option.scaled,
    };
  };

  /**
   * Offers swaps on the rows the pantry does not cover, once the review is
   * open: a failed read leaves the rows as they are.
   */
  const loadSubstitutes = async (uncovered: Set<string>) => {
    if (!recipeId || !homeId || !pantryId || uncovered.size === 0) return;
    let result;
    try {
      result = await loadSubstitutesQuery({
        variables: {
          recipeId,
          homeId,
          pantryId,
          ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
        },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Load recipe substitutes error:',
      });
    }
    const swaps = new Map<string, CookSubstitute[]>();
    for (const { node } of result?.data?.recipe?.ingredientsConnection.edges ??
      []) {
      if (!uncovered.has(node.id)) continue;
      const options = node.substitutes.flatMap(
        option => toCookSubstitute(option) ?? [],
      );
      if (options.length > 0) swaps.set(node.id, options);
    }
    if (swaps.size === 0) return;
    setEditableMatches(prev =>
      prev.map(em => {
        const options = swaps.get(em.ingredient.id);
        return options ? { ...em, substitutes: options } : em;
      }),
    );
  };

  // The reviewed cook is the quick cook's own write with `exactStacks`: one
  // transaction, so it deducts every stack stated or none.
  const [confirmMutation, { loading: confirmLoading }] = useMutation(
    MarkRecipeAsCookedDocument,
    { context: { localFirst: true } },
  );

  const loadMatches = async (servings: number) => {
    if (!recipeId || !pantryId) {
      toastService.error(t('recipes.recipeOrPantryUnavailable'));
      return false;
    }

    let result;
    try {
      result = await loadMatchesQuery({
        variables: { recipeId, pantryId, servings },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Load recipe matches error:',
      });
    }
    if (!result) return false;

    const matches = result.data?.matchRecipeIngredientsToPantry;
    // A read that failed (offline) is not an empty answer: the caller cooks
    // without the review instead.
    if (!matches) return false;
    if (matches.length === 0) {
      toastService.info(t('recipes.noIngredientsToMatch'));
      return false;
    }

    const editable: EditableMatch[] = matches
      .map((match): EditableMatch | null => {
        // The match query spreads RecipeIngredientFragment on `ingredient`, so
        // a null means the server returned an ingredient missing a fragment
        // field: surfaced, not silently dropped from the sheet.
        const ingredient = client.cache.readFragment<RecipeIngredientFragment>({
          fragment: RecipeIngredientFragmentDoc,
          fragmentName: 'RecipeIngredientFragment',
          from: match.ingredient,
        });
        if (!ingredient) {
          logger.warn(
            '[useRecipeIngredientMatching] incomplete RecipeIngredient in cache; dropping from matches',
            { recipeId, ingredientId: match.ingredient.id },
          );
          return null;
        }
        const status = getAvailabilityStatus(match);
        return {
          match,
          ingredient,
          stackOptions: match.matchedPantryItem
            ? [match.matchedPantryItem, ...match.alternativeMatches]
            : [],
          selectedStack: match.matchedPantryItem,
          adjustedQuantity: match.suggestedQuantity,
          adjustedUnitId:
            match.suggestedUnit?.id ?? ingredient.unit?.id ?? null,
          // An empty stack would only fail the deduction; picking another
          // stack includes the line. One stating no amount has nothing to
          // deduct until the cook states it.
          isIncluded:
            match.suggestedQuantity !== null &&
            !ingredient.isOptional &&
            (status === 'available' || status === 'partial'),
          substitutes: [],
          selectedSubstitute: null,
        };
      })
      .filter((m): m is EditableMatch => m !== null);

    setEditableMatches(editable);
    setIsSheetVisible(true);
    void loadSubstitutes(
      new Set(
        editable
          .filter(em => {
            const status = getAvailabilityStatus(em.match);
            return status === 'missing' || status === 'partial';
          })
          .map(em => em.ingredient.id),
      ),
    );
    return true;
  };

  const updateMatch = (index: number, updates: MatchUpdate) => {
    setEditableMatches(prev => {
      const next = [...prev];
      const existing = next[index];
      if (!existing) return prev;
      next[index] = { ...existing, ...updates };
      return next;
    });
  };

  let available = 0;
  let partial = 0;
  let missing = 0;
  let unsure = 0;
  let included = 0;

  for (const em of editableMatches) {
    const status = getAvailabilityStatus(em.match);
    if (status === 'available') available++;
    else if (status === 'partial') partial++;
    else if (status === 'unsure') unsure++;
    else missing++;
    if (em.isIncluded) included++;
  }

  const matchSummary: MatchSummary = {
    total: editableMatches.length,
    available,
    partial,
    missing,
    unsure,
    included,
  };

  const confirmConsumption = async (cook?: CookEntry) => {
    if (!recipeId || !pantryId) return;

    const ingredientsUsed: IngredientUsageInput[] = editableMatches.flatMap(
      em => {
        const swap = em.selectedSubstitute;
        if (swap) {
          if (!em.isIncluded) return [];
          // Its parts are drawn instead; the ingredient's own stacks are not.
          const ratio = swap.scaled
            ? servingsRatio(em.match, em.ingredient)
            : 1;
          return swap.parts.map(part => ({
            recipeIngredientId: em.ingredient.id,
            pantryItemId: part.stack.id,
            actualQuantity: part.quantity * ratio,
            actualUnitId: part.unitId,
            substituteId: swap.id,
          }));
        }
        const pantryItem = em.selectedStack;
        const quantity = em.adjustedQuantity;
        if (
          !em.isIncluded ||
          !pantryItem ||
          quantity === null ||
          quantity <= 0
        ) {
          return [];
        }
        return [
          {
            recipeIngredientId: em.ingredient.id,
            pantryItemId: pantryItem.id,
            actualQuantity: quantity,
            actualUnitId:
              em.adjustedUnitId ??
              em.match.suggestedUnit?.id ??
              pantryItem.unit.id,
          },
        ];
      },
    );

    if (ingredientsUsed.length === 0) {
      toastService.info(t('recipes.noIngredientsForDeduction'));
      return;
    }

    // Mint the cooking-log id client-side and queue + replay (`localFirst`) when
    // the API is unreachable. The shared id means a re-synced cook converges on
    // the same cooking log instead of creating a duplicate and re-deducting.
    const settled = await settleMutation(
      () =>
        confirmMutation({
          variables: {
            input: {
              id: generateEntityId(),
              recipeId,
              pantryId,
              deductFromPantry: true,
              // Each entry draws on the stack it names and no other; an
              // ingredient with no entry is left alone.
              exactStacks: true,
              ingredientsUsed,
              servings: cook?.servings,
              notes: cook?.notes,
            },
          },
        }),
      {
        document: MarkRecipeAsCookedDocument,
        fallback: t('recipes.markCookedFailed'),
        // The review sheet reports the cook as a toast and stays open to retry.
        present: 'toast',
      },
    );
    // Applied and queued both succeed; a queued cook replays later.
    if (settled.failure) return;

    const data = appliedPayload(settled.data);
    // Replay diagnostics: `converged: true` means this client-minted cooking-log
    // id already existed (an idempotent replay), not a fresh cook.
    if (data?.converged) {
      logger.info('markRecipeAsCooked converged — replay of a reviewed cook', {
        recipeId,
      });
    }
    // The cook commits whole. What it reports apart are the entries no
    // conversion could take to their stack's unit; queued, every entry replays.
    const skippedCount = data?.skippedIngredients.length ?? 0;
    const deductedCount = ingredientsUsed.length - skippedCount;
    toastService.success(
      skippedCount > 0
        ? t('recipes.deductedFromPantryFailed', {
            count: deductedCount,
            failed: skippedCount,
          })
        : t('recipes.deductedFromPantry', { count: deductedCount }),
    );

    Telemetry.trackEvent('recipe_consumption_confirmed', {
      recipe_id: recipeId,
      pantry_id: pantryId,
      consumed_count: data ? deductedCount : 0,
      failed_count: skippedCount,
    });

    setIsSheetVisible(false);
    setEditableMatches([]);
  };

  const closeSheet = () => {
    setIsSheetVisible(false);
  };

  return {
    loadMatches,
    editableMatches,
    updateMatch,
    matchSummary,
    confirmConsumption,
    confirmLoading,
    isSheetVisible,
    closeSheet,
    hasPantry: !!pantryId,
  };
}
