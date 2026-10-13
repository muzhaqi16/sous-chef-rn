import { parse } from 'graphql';
import { RestockPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  CreateMealPlanDocument,
  CreateMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { withCalendarDays, withExpiresOn } from '../legacyExpiry';

describe('withExpiresOn', () => {
  it('replays a queued local-midnight instant as that local day', () => {
    const picked = new Date(2026, 8, 21);
    expect(
      withExpiresOn(RestockPantryItemDocument, {
        input: { id: 'p1', expiresAt: picked.toISOString() },
      }),
    ).toEqual({ input: { id: 'p1', expiresOn: '2026-09-21' } });
  });

  it('keeps a cleared expiry cleared', () => {
    expect(
      withExpiresOn(RestockPantryItemDocument, {
        input: { id: 'p1', expiresAt: null },
      }),
    ).toEqual({ input: { id: 'p1', expiresOn: null } });
  });

  it('leaves a write that already sends expiresOn alone', () => {
    const variables = { input: { id: 'p1', expiresOn: '2026-09-21' } };
    expect(withExpiresOn(RestockPantryItemDocument, variables)).toBe(variables);
  });

  // An invite's expiry is still an instant.
  it('leaves an input whose expiresAt did not move alone', () => {
    const invite = parse(
      'mutation Invite($input: InviteToShoppingListInput!) { inviteToShoppingList(input: $input) { __typename } }',
    );
    const variables = {
      input: { listId: 'l1', expiresAt: '2026-09-21T10:00:00.000Z' },
    };
    expect(withExpiresOn(invite, variables)).toBe(variables);
  });
});

describe('withCalendarDays', () => {
  // The previous build sent a day as local noon, whose local day is the pick.
  const localNoon = (year: number, month: number, day: number) =>
    new Date(year, month, day, 12).toISOString();

  it('replays a queued meal instant as the local day it stood for', () => {
    expect(
      withCalendarDays(CreateMealPlanItemDocument, {
        input: {
          id: 'meal-1',
          mealPlanId: 'plan-1',
          date: localNoon(2026, 8, 21),
        },
      }),
    ).toEqual({
      input: { id: 'meal-1', mealPlanId: 'plan-1', date: '2026-09-21' },
    });
  });

  it('replays both ends of a queued plan as days', () => {
    expect(
      withCalendarDays(CreateMealPlanDocument, {
        input: {
          id: 'plan-1',
          startDate: localNoon(2026, 8, 21),
          endDate: localNoon(2026, 8, 27),
        },
      }).input,
    ).toEqual({ id: 'plan-1', startDate: '2026-09-21', endDate: '2026-09-27' });
  });

  it('leaves a write that already sends a day alone', () => {
    const variables = {
      input: { id: 'meal-1', mealPlanId: 'plan-1', date: '2026-09-21' },
    };
    expect(withCalendarDays(CreateMealPlanItemDocument, variables)).toBe(
      variables,
    );
  });

  // `expiresAt` on a restock is another input's field: not this rewrite's.
  it('leaves an input that holds no plan day alone', () => {
    const variables = { input: { id: 'p1', date: localNoon(2026, 8, 21) } };
    expect(withCalendarDays(RestockPantryItemDocument, variables)).toBe(
      variables,
    );
  });
});
