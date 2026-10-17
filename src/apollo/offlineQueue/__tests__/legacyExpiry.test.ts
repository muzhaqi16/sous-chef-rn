import { parse } from 'graphql';
import { RestockPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  CreateMealPlanDocument,
  CreateMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { withCalendarDays, withExpiresOn } from '../legacyExpiry';

// An invite's expiry is still an instant.
const InviteDocument = parse(
  'mutation Invite($input: InviteToShoppingListInput!) { inviteToShoppingList(input: $input) { __typename } }',
);

describe('withExpiresOn', () => {
  it.each([
    [
      'replays a queued local-midnight instant as that local day',
      new Date(2026, 8, 21).toISOString(),
      '2026-09-21',
    ],
    ['keeps a cleared expiry cleared', null, null],
  ])('%s', (_, expiresAt, expiresOn) => {
    expect(
      withExpiresOn(RestockPantryItemDocument, {
        input: { id: 'p1', expiresAt },
      }),
    ).toEqual({ input: { id: 'p1', expiresOn } });
  });

  it.each([
    [
      'a write that already sends expiresOn',
      RestockPantryItemDocument,
      { id: 'p1', expiresOn: '2026-09-21' },
    ],
    [
      'an input whose expiresAt did not move',
      InviteDocument,
      { listId: 'l1', expiresAt: '2026-09-21T10:00:00.000Z' },
    ],
  ])('leaves %s alone', (_, document, input) => {
    const variables = { input };
    expect(withExpiresOn(document, variables)).toBe(variables);
  });
});

describe('withCalendarDays', () => {
  // The previous build sent a day as local noon, whose local day is the pick.
  const localNoon = (year: number, month: number, day: number) =>
    new Date(year, month, day, 12).toISOString();

  it.each([
    [
      'replays a queued meal instant as the local day it stood for',
      CreateMealPlanItemDocument,
      { id: 'meal-1', mealPlanId: 'plan-1', date: localNoon(2026, 8, 21) },
      { id: 'meal-1', mealPlanId: 'plan-1', date: '2026-09-21' },
    ],
    [
      'replays both ends of a queued plan as days',
      CreateMealPlanDocument,
      {
        id: 'plan-1',
        startDate: localNoon(2026, 8, 21),
        endDate: localNoon(2026, 8, 27),
      },
      { id: 'plan-1', startDate: '2026-09-21', endDate: '2026-09-27' },
    ],
  ])('%s', (_, document, input, expected) => {
    expect(withCalendarDays(document, { input })).toEqual({ input: expected });
  });

  it.each([
    [
      'a write that already sends a day',
      CreateMealPlanItemDocument,
      { id: 'meal-1', mealPlanId: 'plan-1', date: '2026-09-21' },
    ],
    // `expiresAt` on a restock is another input's field: not this rewrite's.
    [
      'an input that holds no plan day',
      RestockPantryItemDocument,
      { id: 'p1', date: localNoon(2026, 8, 21) },
    ],
  ])('leaves %s alone', (_, document, input) => {
    const variables = { input };
    expect(withCalendarDays(document, variables)).toBe(variables);
  });
});
