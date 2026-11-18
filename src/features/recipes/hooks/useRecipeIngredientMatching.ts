import { useRef, useState } from 'react';
import { useTranslation, type TranslateFn } from '#/i18n';
import {
  useApolloClient,
  useLazyQuery,
  useMutation,
} from '@apollo/client/react';
import {
  MatchRecipeIngredientsToPantryDocument,
  MarkRecipeAsCookedDocument,
  RecipeCookUsesDocument,
  type MarkRecipeAsCookedMutationVariables,
  type MatchRecipeIngredientsToPantryQuery,
} from '#features/recipes/graphql/recipe.generated';
import {
  RecipeIngredientFragmentDoc,
  type RecipeIngredientFragment,
} from '#features/recipes/graphql/recipeFragments.generated';
import { RecipeIngredientMatchKind } from '#/graphql/generated/schemaTypes';
import {
  cookOutcome,
  type CookDraw,
  type CookOutcome,
  type RecordedUse,
} from '#features/recipes/utils/cookOutcome';
import { cappedNames } from '#/utils/cappedNames';
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
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { inTrackingUnit } from '#features/pantry/cache/stock';
import type {
  CookDrawInputs,
  CookRecipeInputs,
} from '#features/recipes/offline/localWrites';
import { emitTutorialEvent } from '#domain/tutorialEvents';
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

/** The planned meal a cook completes with it, at the version last read. */
interface PlannedMeal {
  id: string;
  version: number;
}

export interface CookContext {
  plannedMeal?: PlannedMeal | null;
  /** Shows the meal as it now stands: changed, or cooked by someone else. */
  onMealChanged?: () => void;
}

/** A cook's link to its planned meal, sent with the meal's version. */
export const plannedMealInput = (plannedMeal: PlannedMeal | null | undefined) =>
  plannedMeal
    ? {
        mealPlanItemId: plannedMeal.id,
        mealPlanItemVersion: plannedMeal.version,
      }
    : {};

/**
 * How a planned meal's cook is refused: the meal changed since it was read, or
 * another cook completed it. Either way the meal is shown as it now stands.
 */
export const plannedMealSettle = (
  t: TranslateFn,
  { plannedMeal, onMealChanged }: CookContext,
) =>
  plannedMeal
    ? {
        onVersionConflict: onMealChanged,
        copy: {
          CONFLICT: {
            title: t('labels.error'),
            body: t('recipes.mealAlreadyCooked'),
          },
        },
        ...(onMealChanged && { on: { CONFLICT: onMealChanged } }),
      }
    : {};

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
  if (stack.amountLeft.value > 0) return 'partial';
  return 'missing';
}

/** A cook row as the answer and the page read state it. */
interface CookedUseRow {
  quantityUsed: number;
  usageUnit: RecordedUse['unit'];
  pantryItem: { id: string; quantity: number } | null;
}

const recordedUses = (rows: readonly { node: CookedUseRow }[]) =>
  rows.flatMap(({ node }): RecordedUse[] =>
    node.pantryItem
      ? [
          {
            pantryItemId: node.pantryItem.id,
            quantityUsed: node.quantityUsed,
            unit: node.usageUnit,
            stackLeft: node.pantryItem.quantity,
          },
        ]
      : [],
  );

// Each page is a request; a cook draws far fewer stacks than this many pages hold.
const MAX_USE_PAGES = 5;

export function useRecipeIngredientMatching(
  recipeId: string | undefined,
  { plannedMeal, onMealChanged }: CookContext = {},
) {
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
  const cooking = useRef(false);

  /** A reviewed cook, held as a pending layer that draws what it states. */
  const sendCook = (
    variables: MarkRecipeAsCookedMutationVariables,
    inputs: CookRecipeInputs,
  ) =>
    pendingWritesOf(client.cache).send(
      MarkRecipeAsCookedDocument,
      variables,
      write =>
        settleMutation(() => confirmMutation(write), {
          document: MarkRecipeAsCookedDocument,
          fallback: t('recipes.markCookedFailed'),
          // The review sheet reports the cook as a toast and stays open to retry.
          present: 'toast',
          ...plannedMealSettle(t, { plannedMeal, onMealChanged }),
        }),
      inputs,
    );

  /**
   * The rows a cook recorded past its answer's page, read while it is still the
   * recipe's newest log; null when they could not all be read.
   */
  const remainingUses = async (
    cookingLogId: string,
    after: string | null | undefined,
  ): Promise<RecordedUse[] | null> => {
    if (!recipeId) return null;
    const uses: RecordedUse[] = [];
    let cursor = after;
    for (let page = 0; page < MAX_USE_PAGES; page++) {
      if (!cursor) return uses;
      let result;
      try {
        result = await client.query({
          query: RecipeCookUsesDocument,
          variables: { recipeId, after: cursor },
          fetchPolicy: 'network-only',
        });
      } catch (error) {
        errorService.reportError(error, { operation: 'Read cook uses' });
      }
      const [edge] = result?.data?.recipeCookingLogs.edges ?? [];
      if (edge?.node.id !== cookingLogId) return null;
      const connection = edge.node.pantryItemsUsedConnection;
      uses.push(...recordedUses(connection.edges));
      cursor = connection.pageInfo.hasNextPage
        ? connection.pageInfo.endCursor
        : null;
    }
    return cursor ? null : uses;
  };

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
          optimistic: true,
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
    // Its ask in the stack's own unit is what the device can draw at once.
    const entry = (
      stack: PantryStackOption,
      usage: CookDraw['usage'],
    ): CookDraw => ({
      stackName: stack.itemName,
      stackUnitId: stack.unit.id,
      usage,
      inStackUnit: inTrackingUnit(
        client.cache,
        stack.id,
        usage.actualQuantity,
        usage.actualUnitId,
      ),
    });
    const entries: CookDraw[] = editableMatches.flatMap(em => {
      const swap = em.selectedSubstitute;
      if (swap) {
        if (!em.isIncluded) return [];
        // Its parts are drawn instead; the ingredient's own stacks are not.
        return swap.parts.map(part =>
          entry(part.stack, {
            recipeIngredientId: em.ingredient.id,
            pantryItemId: part.stack.id,
            actualQuantity: part.quantity,
            actualUnitId: part.unitId,
            substituteId: swap.id,
          }),
        );
      }
      const pantryItem = em.selectedStack;
      const quantity = em.adjustedQuantity;
      if (!em.isIncluded || !pantryItem || quantity === null || quantity <= 0) {
        return [];
      }
      return [
        entry(pantryItem, {
          recipeIngredientId: em.ingredient.id,
          pantryItemId: pantryItem.id,
          actualQuantity: quantity,
          actualUnitId:
            em.adjustedUnitId ??
            em.match.suggestedUnit?.id ??
            pantryItem.unit.id,
        }),
      ];
    });
    const ingredientsUsed = entries.map(({ usage }) => usage);

    if (ingredientsUsed.length === 0) {
      toastService.info(t('recipes.noIngredientsForDeduction'));
      return;
    }

    // One cooking-log id per confirmed cook, queued with it, so a replay
    // converges on the same log instead of deducting again. A tap while it is
    // in flight is the same cook.
    if (cooking.current) return;
    cooking.current = true;
    // What the device can prove moves at once, as a use does; the rest waits.
    const draws: CookDrawInputs[] = entries.flatMap(({ usage, inStackUnit }) =>
      usage.pantryItemId
        ? [
            {
              pantryItemId: usage.pantryItemId,
              delta: inStackUnit === null ? null : -inStackUnit,
              stated: {
                amount: usage.actualQuantity,
                unitId: usage.actualUnitId,
              },
            },
          ]
        : [],
    );
    const cookingLogId = generateEntityId();
    const variables = {
      input: {
        id: cookingLogId,
        recipeId,
        pantryId,
        deductFromPantry: true,
        // Each entry draws on the stack it names and no other; an
        // ingredient with no entry is left alone.
        exactStacks: true,
        ingredientsUsed,
        servings: cook?.servings,
        notes: cook?.notes,
        ...plannedMealInput(plannedMeal),
      },
    };
    const inputs: CookRecipeInputs = {
      draws,
      now: new Date().toISOString(),
      ...(plannedMeal && { meal: { id: plannedMeal.id, cookingLogId } }),
    };
    // A send that throws releases the guard too, or every later confirm is lost.
    let settled: Awaited<ReturnType<typeof sendCook>>;
    try {
      settled = await sendCook(variables, inputs);
    } catch (error) {
      cooking.current = false;
      errorService.reportError(error, { operation: 'Record reviewed cook' });
      toastService.error(t('recipes.markCookedFailed'));
      return;
    }
    cooking.current = false;
    // Applied and queued both succeed; a queued cook replays later.
    if (settled.failure) return;
    emitTutorialEvent('recipe.cooked');
    setIsSheetVisible(false);
    setEditableMatches([]);

    // Queued, nothing is deducted yet: the server has not taken it.
    if (settled.status === 'queued') {
      toastService.info(t('recipes.cookedQueued'));
      return;
    }
    const data = appliedPayload(settled.data);
    // Replay diagnostics: `converged: true` means this client-minted cooking-log
    // id already existed (an idempotent replay), not a fresh cook.
    if (data?.converged) {
      logger.info('markRecipeAsCooked converged — replay of a reviewed cook', {
        recipeId,
      });
    }
    // What each stack recorded, not what was asked: another use may have left
    // a stack shorter than the review saw. The toast counts ingredients, and a
    // swap's parts are entries of one.
    const page = data?.cookingLog.pantryItemsUsedConnection;
    const rest = page?.pageInfo.hasNextPage
      ? await remainingUses(cookingLogId, page.pageInfo.endCursor)
      : [];
    const outcome = cookOutcome(
      entries,
      data?.skippedIngredients ?? [],
      [...recordedUses(page?.edges ?? []), ...(rest ?? [])],
      { complete: !!page && rest !== null },
    );
    const failed = outcome.undeducted.size;
    const deductedCount = Math.max(
      0,
      new Set(ingredientsUsed.map(usage => usage.recipeIngredientId)).size -
        failed -
        outcome.unconfirmed.size,
    );
    reportCook(deductedCount, failed, outcome);

    Telemetry.trackEvent('recipe_consumption_confirmed', {
      recipe_id: recipeId,
      pantry_id: pantryId,
      consumed_count: deductedCount,
      failed_count: failed,
    });
  };

  /** What the cook drew, stated from what it recorded. */
  const reportCook = (
    count: number,
    failed: number,
    { short, unconfirmed }: CookOutcome,
  ) => {
    if (unconfirmed.size > 0) {
      toastService.info(t('recipes.cookedUnconfirmed'));
      return;
    }
    const drawn =
      failed > 0
        ? t('recipes.deductedFromPantryFailed', { count, failed })
        : t('recipes.deductedFromPantry', { count });
    if (short.length === 0) {
      toastService.success(drawn);
      return;
    }
    const { shown, remainder } = cappedNames(
      short.map(draw =>
        t('recipes.substitutes.part', {
          amount: formatQuantityWithUnit(draw.recorded, draw.unit),
          name: draw.stackName,
        }),
      ),
    );
    toastService.warning(
      remainder > 0
        ? t('recipes.onlyLeftMore', { drawn, left: shown, count: remainder })
        : t('recipes.onlyLeft', { drawn, left: shown, count: short.length }),
    );
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
