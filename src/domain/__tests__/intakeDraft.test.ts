import { resolveIntakeDraft } from '../intakeDraft';
import { pantryTrackingExamples as examples } from '#/test-utils/fixtures/pantryTrackingFixtures';

it('IN-02 states the six contained cans once, without expanding them again', () => {
  const result = resolveIntakeDraft({
    purchased: {
      quantity: 6,
      intent: 'packages',
      packageSize: { netWeight: 250, netWeightUnitId: 'ml' },
    },
  });
  expect(result.amount).toEqual({
    packages: { count: 6, size: { netWeight: 250, netWeightUnitId: 'ml' } },
  });
  expect(result.unresolved).toEqual([]);
  expect(examples['IN-02'].expected.remainingMl).toBe(1500);
});
it('IN-03 states a measured purchase as weighed', () => {
  expect(
    resolveIntakeDraft({
      purchased: { quantity: 2.21, unitId: 'lb', intent: 'measured' },
    }).amount,
  ).toEqual({ measured: { quantity: 2.21, unitId: 'lb' } });
});
it('IN-05 keeps each acquisition size and never mutates a previous draft', () => {
  const first = resolveIntakeDraft({
    purchased: {
      quantity: 1,
      intent: 'packages',
      packageSize: { netWeight: 16, netWeightUnitId: 'oz' },
    },
  });
  const second = resolveIntakeDraft({
    purchased: {
      quantity: 1,
      intent: 'packages',
      packageSize: { netWeight: 24, netWeightUnitId: 'oz' },
    },
  });
  expect(first.amount?.packages?.size?.netWeight).toBe(16);
  expect(second.amount?.packages?.size?.netWeight).toBe(24);
});
it('retains an unknown-size package without inventing its contents', () => {
  expect(resolveIntakeDraft({ purchased: { quantity: 1 } }).amount).toEqual({
    packages: { count: 1 },
  });
});
it.each([NaN, Infinity, 0, -1])(
  'rejects an invalid acquisition quantity %s',
  quantity => {
    expect(resolveIntakeDraft({ purchased: { quantity } })).toMatchObject({
      amount: null,
      unresolved: ['quantity'],
    });
  },
);
it('takes a measured amount without a unit only where the route supplies one', () => {
  const purchased = { quantity: 6, intent: 'measured' as const };
  expect(resolveIntakeDraft({ purchased })).toMatchObject({
    amount: null,
    unresolved: ['unit'],
  });
  expect(resolveIntakeDraft({ purchased, unitFromRoute: true })).toMatchObject({
    amount: { measured: { quantity: 6 } },
    unresolved: [],
  });
});
// The API refuses a stock amount past 999,999, so the line is asked about first.
it('asks again about an amount past the cap', () => {
  expect(
    resolveIntakeDraft({
      purchased: { quantity: 1_000_000, unitId: 'g', intent: 'measured' },
    }),
  ).toEqual({ amount: null, unresolved: ['quantity'] });
  expect(
    resolveIntakeDraft({
      purchased: { quantity: 999_999, unitId: 'g', intent: 'measured' },
    }).amount,
  ).toEqual({ measured: { quantity: 999_999, unitId: 'g' } });
});
