import { useRef, useState } from 'react';
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
import { formatQuantityWithUnit } from '#/utils/formatQuantity';
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
  /** `isIncluded` before a swap was picked, restored when it is unpicked. */
  includedBeforeSubstitute: boolean;
}

export type MatchUpdate = Partial<
  Pick<
    EditableMatch,
    | 'adjustedQuantity'
    | 'isIncluded'
    | 'selectedStack'
    | 'selectedSubstitute'
    | 'includedBeforeSubstitute'
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

/** One entry a reviewed cook sends, under the stack it draws on. */
interface CookDraw {
  stackName: string;
  stackUnitId: string;
  usage: IngredientUsageInput;
}

/**
 * The ingredients a cook left undeducted. The API names a skip only by its
 * stack's name and units, so each skip claims an entry of its own: two entries
 * drawn from stacks of one name are two skips. A skip no entry claims counts
 * on its own, so none is hidden.
 */
function undeductedIngredients(
  draws: readonly CookDraw[],
  skips: readonly {
    itemName: string;
    fromUnitId?: string | null;
    toUnitId: string;
  }[],
): Set<string> {
  const claimed = new Set<number>();
  const claim = (fits: (draw: CookDraw) => boolean) => {
    const index = draws.findIndex(
      (draw, position) => !claimed.has(position) && fits(draw),
    );
    if (index === -1) return null;
    claimed.add(index);
    return draws[index] ?? null;
  };
  const undeducted = new Set<string>();
  skips.forEach((skip, position) => {
    const draw =
      claim(
        candidate =>
          candidate.stackName === skip.itemName &&
          candidate.usage.actualUnitId === skip.fromUnitId &&
          candidate.stackUnitId === skip.toUnitId,
      ) ?? claim(candidate => candidate.stackName === skip.itemName);
    undeducted.add(draw?.usage.recipeIngredientId ?? `skip:${position}`);
  });
  return undeducted;
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
  // The newest review's read: a slower one from an earlier open, scaled to
  // its servings, never lands on a later review.
  const substitutesRead = useRef(0);

  /** A swap at the amount cooked: scaled parts are for the recipe as written. */
  const toCookSubstitute = (
    option: SubstituteOptionData,
    servingsRatio: number,
  ): CookSubstitute | null => {
    const ratio = option.scaled ? servingsRatio : 1;
    const parts = option.parts.map(part => ({
      ...part,
      quantity: part.quantity * ratio,
    }));
    const texts = parts.map(part =>
      t('recipes.substitutes.part', {
        amount: formatQuantityWithUnit(part.quantity, part.unit),
        name: part.item.name,
      }),
    );
    const held = parts.flatMap((part, index) =>
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
    };
  };

  /**
   * Offers swaps on the rows the pantry does not cover, once the review is
   * open: a failed read leaves the rows as they are.
   */
  const loadSubstitutes = async (uncovered: Set<string>, servings: number) => {
    substitutesRead.current += 1;
    const read = substitutesRead.current;
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
    const recipe = result?.data?.recipe;
    if (!recipe || read !== substitutesRead.current) return;
    // As the cook scales every amount: servings / Recipe.servings.
    const ratio = recipe.servings > 0 ? servings / recipe.servings : 1;
    const swaps = new Map<string, CookSubstitute[]>();
    for (const { node } of recipe.ingredientsConnection.edges) {
      if (!uncovered.has(node.id)) continue;
      const options = node.substitutes.flatMap(
        option => toCookSubstitute(option, ratio) ?? [],
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
        // An empty stack would only fail the deduction; picking another
        // stack includes the line. One stating no amount has nothing to
        // deduct until the cook states it.
        const isIncluded =
          match.suggestedQuantity !== null &&
          !ingredient.isOptional &&
          (status === 'available' || status === 'partial');
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
          isIncluded,
          substitutes: [],
          selectedSubstitute: null,
          includedBeforeSubstitute: isIncluded,
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
      servings,
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

    // Each entry keeps its stack's name and unit: a skip reports it by them.
    const entries: CookDraw[] = editableMatches.flatMap(em => {
      const swap = em.selectedSubstitute;
      if (swap) {
        if (!em.isIncluded) return [];
        // Its parts are drawn instead; the ingredient's own stacks are not.
        return swap.parts.map(part => ({
          stackName: part.stack.itemName,
          stackUnitId: part.stack.unit.id,
          usage: {
            recipeIngredientId: em.ingredient.id,
            pantryItemId: part.stack.id,
            actualQuantity: part.quantity,
            actualUnitId: part.unitId,
            substituteId: swap.id,
          },
        }));
      }
      const pantryItem = em.selectedStack;
      const quantity = em.adjustedQuantity;
      if (!em.isIncluded || !pantryItem || quantity === null || quantity <= 0) {
        return [];
      }
      return [
        {
          stackName: pantryItem.itemName,
          stackUnitId: pantryItem.unit.id,
          usage: {
            recipeIngredientId: em.ingredient.id,
            pantryItemId: pantryItem.id,
            actualQuantity: quantity,
            actualUnitId:
              em.adjustedUnitId ??
              em.match.suggestedUnit?.id ??
              pantryItem.unit.id,
          },
        },
      ];
    });
    const ingredientsUsed = entries.map(entry => entry.usage);

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
    // The toast counts ingredients, and a swap's parts are entries of one.
    const notDeducted = undeductedIngredients(
      entries,
      data?.skippedIngredients ?? [],
    );
    const skippedCount = notDeducted.size;
    const deductedCount = Math.max(
      0,
      new Set(ingredientsUsed.map(usage => usage.recipeIngredientId)).size -
        skippedCount,
    );
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
