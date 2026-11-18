import type { IngredientUsageInput } from '#/graphql/generated/schemaTypes';
import type { UnitLabelSource } from '#/utils/formatQuantity';

/** One entry a reviewed cook sends, under the stack it draws on. */
export interface CookDraw {
  stackName: string;
  stackUnitId: string;
  usage: IngredientUsageInput;
  /** The ask in the stack's tracking unit, where the device can say. */
  inStackUnit: number | null;
}

/** A row the cook recorded: what its stack gave, and what the stack holds now. */
export interface RecordedUse {
  pantryItemId: string;
  quantityUsed: number;
  unit: (UnitLabelSource & { id: string }) | null;
  stackLeft: number;
}

/** A draw its stack could not fill: what was recorded for it. */
interface ShortDraw {
  ingredientId: string;
  stackName: string;
  recorded: number;
  unit: UnitLabelSource | null;
}

export interface CookOutcome {
  /** Ingredients nothing was drawn for. */
  undeducted: Set<string>;
  short: ShortDraw[];
  /** Ingredients whose rows were not read: neither drawn nor undrawn is known. */
  unconfirmed: Set<string>;
}

interface Skip {
  itemName: string;
  fromUnitId?: string | null;
  toUnitId: string;
}

const TOLERANCE = 1e-6;

/** A draw's ask in the unit its stack recorded, or null where the device cannot say. */
function askIn(draw: CookDraw, unitId: string | undefined): number | null {
  if (unitId === undefined) return null;
  if (draw.usage.actualUnitId === unitId) return draw.usage.actualQuantity;
  if (draw.stackUnitId === unitId) return draw.inStackUnit;
  return null;
}

/**
 * What a reviewed cook recorded against what it asked. A draw stops at what
 * its stack holds, so a stack another use emptied records less, or no row.
 * The API names a skip only by its stack's name and units: each claims an
 * entry of its own, and one no entry claims still counts.
 */
export function cookOutcome(
  draws: readonly CookDraw[],
  skips: readonly Skip[],
  uses: readonly RecordedUse[],
  { complete }: { complete: boolean },
): CookOutcome {
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

  const byStack = new Map<string, CookDraw[]>();
  draws.forEach((draw, position) => {
    const stackId = draw.usage.pantryItemId;
    if (claimed.has(position) || !stackId) return;
    byStack.set(stackId, [...(byStack.get(stackId) ?? []), draw]);
  });

  const short: ShortDraw[] = [];
  const unconfirmed = new Set<string>();
  for (const [stackId, stackDraws] of byStack) {
    const rows = uses.filter(use => use.pantryItemId === stackId);
    const [first] = rows;
    if (!first) {
      // No row is no draw only once every row was read.
      for (const draw of stackDraws) {
        (complete ? undeducted : unconfirmed).add(
          draw.usage.recipeIngredientId,
        );
      }
      continue;
    }
    const unit = first.unit;
    const oneUnit = rows.every(row => row.unit?.id === unit?.id);
    const recorded = rows.reduce((sum, row) => sum + row.quantityUsed, 0);
    const asks = stackDraws.map(draw => askIn(draw, unit?.id));
    if (oneUnit && asks.every(ask => ask !== null)) {
      let left = recorded;
      stackDraws.forEach((draw, index) => {
        const ask = asks[index] ?? 0;
        const given = Math.min(left, ask);
        left -= given;
        if (given <= TOLERANCE) {
          undeducted.add(draw.usage.recipeIngredientId);
        } else if (given < ask - TOLERANCE) {
          short.push({
            ingredientId: draw.usage.recipeIngredientId,
            stackName: draw.stackName,
            recorded: given,
            unit,
          });
        }
      });
      continue;
    }
    // The ask has no figure in the unit drawn: a stack left empty may have run
    // short, so the cook states what it took rather than claim the whole ask.
    const [firstDraw] = stackDraws;
    if (firstDraw && rows.some(row => row.stackLeft <= TOLERANCE)) {
      short.push({
        ingredientId: firstDraw.usage.recipeIngredientId,
        stackName: firstDraw.stackName,
        recorded,
        unit: oneUnit ? unit : null,
      });
    }
  }
  return { undeducted, short, unconfirmed };
}
