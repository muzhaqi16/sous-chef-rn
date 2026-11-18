import { amountLeftOf, fullPackagesAfter } from '#domain/stockDisplay';
import {
  pantryTrackingContext as context,
  pantryTrackingExamples as examples,
  pantryTrackingUnits as units,
} from '#/test-utils/fixtures/pantryTrackingFixtures';

describe('pantry tracking acceptance fixture catalog', () => {
  it('keeps every numbered example available to intake, cache, cooking, and replay suites', () => {
    expect(Object.keys(examples)).toEqual([
      'IN-01',
      'IN-02',
      'IN-03',
      'IN-04',
      'IN-05',
      'IN-06',
      'USE-01',
      'USE-02',
      'USE-03',
      'USE-04',
      'USE-05',
      'USE-06',
      'COOK-01',
      'COOK-02',
      'COOK-03',
      'CHECK-01',
      'CHECK-02',
      'CHECK-03',
      'CHECK-04',
      'REL-01',
      'REL-02',
      'REL-03',
    ]);
  });

  it('fixes the observation date and keeps lookalike stacks in different households', () => {
    expect(context.today).toBe('2026-11-15');
    expect(context.timezone).toBe('America/New_York');
    expect(context.selected).toMatchObject({ homeId: 'H1', pantryId: 'P1' });
    expect(context.other).toMatchObject({ homeId: 'H2', pantryId: 'P2' });
    expect(context.items.otherEggs.itemId).toBe(context.items.eggs.itemId);
    expect(context.items.otherEggs.stackId).not.toBe(
      context.items.eggs.stackId,
    );
    expect(context.actors.A.homeId).toBe('H1');
    expect(context.actors.B.homeId).toBe('H1');
    expect(examples['REL-01'].confirmedAt).toBe('2026-11-15T15:00:00.000Z');
    expect(examples['REL-01'].replayAt).toBe('2026-11-16T15:00:00.000Z');
    expect(examples['REL-01'].expected.originalDate).toBe('2026-11-15');
  });

  it('anchors IN-02 and USE-03 to one expansion of a six-can multipack', () => {
    const intake = examples['IN-02'];
    const usage = examples['USE-03'];
    expect(intake.outerCount * intake.unitsPerOuter).toBe(6);
    expect(intake.expected.quantity).toBe(6);
    expect(intake.expected.quantity * intake.packageSize.netWeight).toBe(1500);
    expect(intake.expected.remainingMl).toBe(1500);
    expect(usage.before.quantity - usage.use.quantity).toBe(5);
    expect(usage.expected.quantity).toBe(5);
    expect(usage.expected.quantity * usage.packageSize.netWeight).toBe(1250);
    expect(usage.expected.remainingMl).toBe(1250);
  });

  it('anchors USE-01 to 12 - 2 = 10 eggs and one positive usage', () => {
    const example = examples['USE-01'];
    expect(example.before.quantity - example.use.quantity).toBe(10);
    expect(example.expected).toEqual({
      quantity: 10,
      usageQuantity: 2,
      usageCount: 1,
    });
  });

  it.each([
    ['USE-02', units.carton, units.fluidOunce, 56, 0.875, 0],
    ['USE-04', units.pack, units.ounce, 20, 1.25, 1],
  ] as const)(
    '%s exposes literal remaining contents through the existing stock display',
    (id, trackingUnit, contentsUnit, remaining, held, fullPackages) => {
      const example = examples[id];
      expect(example.before.remaining - example.use.quantity).toBe(remaining);
      expect(example.expected.remaining).toBe(remaining);
      expect(example.expected.heldQuantity).toBe(held);
      expect(example.expected.fullPackages).toBe(fullPackages);
      expect(
        example.expected.heldQuantity * example.packageSize.netWeight,
      ).toBe(remaining);
      expect(
        fullPackagesAfter(
          example.before.fullPackages,
          example.before.heldQuantity,
          example.expected.heldQuantity,
        ),
      ).toBe(fullPackages);
      expect(
        amountLeftOf({
          held: example.expected.heldQuantity,
          fullPackages: example.expected.fullPackages,
          trackingType: trackingUnit.type,
          shown: {
            quantity: example.expected.heldQuantity,
            unit: trackingUnit,
          },
          netWeight: { left: example.expected.remaining, unit: contentsUnit },
        }),
      ).toEqual({ quantity: remaining, unit: contentsUnit });
    },
  );

  it('anchors USE-05 to 2 lb - 4 oz = 1.75 lb without requiring a client conversion', () => {
    const example = examples['USE-05'];
    // Independent fixture arithmetic, not a new production conversion route.
    expect(example.before.quantity - example.use.quantity / 16).toBe(1.75);
    expect(example.expected.quantity).toBe(1.75);
    expect(example.offlineWithoutConversion).toEqual({
      quantity: 2,
      status: 'queued',
      pendingOz: 4,
    });
  });

  it('keeps per-batch sizes and default consumption order explicit', () => {
    const jars = examples['IN-05'];
    expect(jars.batches.map(batch => batch.packageSize.netWeight)).toEqual([
      16, 24,
    ]);
    expect(jars.expected.batchContentsOz).toEqual([16, 24]);
    expect(jars.expected.remainingOz).toBe(40);
    expect(jars.nextPackageSize.netWeight).toBe(32);
    const chicken = examples['USE-04'];
    expect(chicken.expected.batchContents).toEqual([4, 16]);
    expect(chicken.explicitlySelectLaterBatch.expectedBatchContents).toEqual([
      16, 4,
    ]);
  });

  it.each(['COOK-01', 'COOK-02'] as const)(
    '%s scales servings exactly once',
    id => {
      const example = examples[id];
      expect(
        (example.recipe.eggs * example.cookedServings) /
          example.recipe.servings,
      ).toBe(4);
      expect(
        (example.recipe.milkFlOz * example.cookedServings) /
          example.recipe.servings,
      ).toBe(16);
      expect(example.expected).toMatchObject({
        eggs: 8,
        milkFlOz: 48,
        usedEggs: 4,
        usedMilkFlOz: 16,
        cookingCount: 1,
        usageCount: 2,
      });
    },
  );

  it('keeps check corrections out of consumption and waste totals', () => {
    expect(examples['CHECK-01'].expected).toEqual({
      quantity: 6,
      adjustment: 4,
      consumption: 0,
      waste: 0,
    });
    expect(examples['CHECK-02'].answers.map(answer => answer.expected)).toEqual(
      [
        { quantity: 10, adjustment: 0, consumption: 0, waste: 0 },
        { quantity: 0, adjustment: 10, consumption: 0, waste: 0 },
        { quantity: 0, adjustment: 0, consumption: 0, waste: 10 },
      ],
    );
    const partial = examples['CHECK-04'];
    expect(partial.before.remaining - partial.answer.remaining).toBe(16);
    expect(partial.expected).toMatchObject({
      remaining: 40,
      heldQuantity: 0.625,
      adjustmentFlOz: 16,
      consumption: 0,
      waste: 0,
    });
  });

  it('uses distinct identities for independent uses and changed refused input', () => {
    const [first, second] = examples['USE-06'].actions;
    expect(first.actionId).not.toBe(second.actionId);
    expect(first.actorId).not.toBe(second.actorId);
    expect(
      examples['USE-06'].before.quantity - first.quantity - second.quantity,
    ).toBe(7);
    expect(examples['USE-06'].expected).toEqual({ quantity: 7, usageCount: 2 });
    expect(examples['REL-02'].correctedActionId).not.toBe(
      examples['REL-02'].rows[1].actionId,
    );
    expect(examples['REL-02'].expected).toEqual({
      acceptedEffectCount: 1,
      refusedEffectCount: 0,
      retryRowCount: 1,
    });
  });
});
