import {
  pantryTrackingContext,
  pantryTrackingExamples,
  pantryTrackingUnits,
} from '#/test-utils/fixtures/pantryTrackingFixtures';
import { cookOutcome, type CookDraw, type RecordedUse } from '../cookOutcome';

const { eggs, milk } = pantryTrackingContext.items;
const { piece, fluidOunce } = pantryTrackingUnits;
const COOK_03 = pantryTrackingExamples['COOK-03'];

const draw = (
  ingredientId: string,
  stack: { stackId: string; name: string },
  amount: number,
  unitId: string,
  overrides: Partial<CookDraw> = {},
): CookDraw => ({
  stackName: stack.name,
  stackUnitId: unitId,
  usage: {
    recipeIngredientId: ingredientId,
    pantryItemId: stack.stackId,
    actualQuantity: amount,
    actualUnitId: unitId,
  },
  inStackUnit: amount,
  ...overrides,
});

const use = (
  stack: { stackId: string },
  quantityUsed: number,
  unit: { id: string; symbol: string },
  stackLeft: number,
): RecordedUse => ({
  pantryItemId: stack.stackId,
  quantityUsed,
  unit,
  stackLeft,
});

// COOK-01's draws at 4 servings: 4 eggs and 16 fl oz.
const EGGS = draw('ing-eggs', eggs, 4, piece.id);
const MILK = draw('ing-milk', milk, 16, fluidOunce.id);
const ALL_READ = { complete: true };

describe('cookOutcome', () => {
  it('reports nothing apart when every draw recorded what it asked', () => {
    const outcome = cookOutcome(
      [EGGS, MILK],
      [],
      [use(eggs, 4, piece, 8), use(milk, 16, fluidOunce, 48)],
      ALL_READ,
    );

    expect(outcome.undeducted.size).toBe(0);
    expect(outcome.short).toEqual([]);
    expect(outcome.unconfirmed.size).toBe(0);
  });

  it('COOK-03 states the 3 eggs another use left, not the 4 asked', () => {
    const { requestedEggs, recordedEggs } = COOK_03.shortDraw;
    const outcome = cookOutcome(
      [draw('ing-eggs', eggs, requestedEggs, piece.id), MILK],
      [],
      [use(eggs, recordedEggs, piece, 0), use(milk, 16, fluidOunce, 48)],
      ALL_READ,
    );

    expect(outcome.short).toEqual([
      { ingredientId: 'ing-eggs', stackName: 'Eggs', recorded: 3, unit: piece },
    ]);
    expect(outcome.undeducted.size).toBe(0);
  });

  it('counts a stack another use emptied, which records no row, as not deducted', () => {
    const outcome = cookOutcome(
      [EGGS, MILK],
      [],
      [use(milk, 16, fluidOunce, 48)],
      ALL_READ,
    );

    expect([...outcome.undeducted]).toEqual(['ing-eggs']);
  });

  it('claims nothing it has not read: a missing row on an unread page is unconfirmed', () => {
    const outcome = cookOutcome(
      [EGGS, MILK],
      [],
      [use(milk, 16, fluidOunce, 48)],
      { complete: false },
    );

    expect(outcome.undeducted.size).toBe(0);
    expect([...outcome.unconfirmed]).toEqual(['ing-eggs']);
  });

  it('names a skip against its own entry, never also as short', () => {
    const outcome = cookOutcome(
      [EGGS, MILK],
      [
        {
          itemName: 'Milk',
          fromUnitId: fluidOunce.id,
          toUnitId: fluidOunce.id,
        },
      ],
      [use(eggs, 4, piece, 8)],
      ALL_READ,
    );

    expect([...outcome.undeducted]).toEqual(['ing-milk']);
    expect(outcome.short).toEqual([]);
  });

  it('compares in the stack unit when the ask was stated in another', () => {
    // 1 cup asked on a fl oz stack the device converts: 8 fl oz; 5 recorded.
    const cup = draw('ing-milk', milk, 1, 'unit-cup', {
      stackUnitId: fluidOunce.id,
      inStackUnit: 8,
    });

    const outcome = cookOutcome(
      [cup],
      [],
      [use(milk, 5, fluidOunce, 0)],
      ALL_READ,
    );

    expect(outcome.short).toEqual([
      expect.objectContaining({ ingredientId: 'ing-milk', recorded: 5 }),
    ]);
  });

  it('states what a stack gave when the ask has no figure in its unit and it ran out', () => {
    const cup = draw('ing-milk', milk, 1, 'unit-cup', {
      stackUnitId: fluidOunce.id,
      inStackUnit: null,
    });

    expect(
      cookOutcome([cup], [], [use(milk, 6, fluidOunce, 0)], ALL_READ).short,
    ).toEqual([
      {
        ingredientId: 'ing-milk',
        stackName: 'Milk',
        recorded: 6,
        unit: fluidOunce,
      },
    ]);
    // A stack that still holds some gave all it was asked.
    expect(
      cookOutcome([cup], [], [use(milk, 6, fluidOunce, 40)], ALL_READ).short,
    ).toEqual([]);
  });

  it('fills two draws on one stack in order, and the second goes short', () => {
    const dough = draw('ing-dough', eggs, 2, piece.id);
    const glaze = draw('ing-glaze', eggs, 2, piece.id);

    const outcome = cookOutcome(
      [dough, glaze],
      [],
      [use(eggs, 3, piece, 0)],
      ALL_READ,
    );

    expect(outcome.short).toEqual([
      expect.objectContaining({ ingredientId: 'ing-glaze', recorded: 1 }),
    ]);
  });

  it('takes a whole egg cracked for half a one asked as the draw met', () => {
    const half = draw('ing-eggs', eggs, 1.5, piece.id);

    expect(
      cookOutcome([half], [], [use(eggs, 2, piece, 10)], ALL_READ).short,
    ).toEqual([]);
  });
});
