import { makeCache } from '#/apollo/cache';
import {
  GONE_REPLAYS,
  REPLAY_RECONCILERS,
} from '#/apollo/offlineQueue/replayRegistry';
import {
  reconcileCreateMealPlanItemReplay,
  settleGoneMealPlanItem,
} from '../replayReconcilers';

const MINTED_ID = 'minted-meal-1';
const SERVER_ID = 'server-meal-1';

/** The version the server's own row is at: another device made and edited it. */
const SERVER_VERSION = 4;

const createVariables = {
  input: { id: MINTED_ID, mealPlanId: 'plan-1', date: '2026-09-29' },
};
const createdAs = (id: string, version: number = SERVER_VERSION) => ({
  createMealPlanItem: {
    __typename: 'CreateMealPlanItemPayload',
    mealPlanItem: { __typename: 'MealPlanItem', id, version },
  },
});

describe('a replayed meal create the server converged onto a held meal', () => {
  it('is registered for CreateMealPlanItem', () => {
    expect(REPLAY_RECONCILERS.CreateMealPlanItem).toBe(
      reconcileCreateMealPlanItemReplay,
    );
  });

  it('leaves the writes behind a meal the server created under its minted id', () => {
    const adopt = jest.fn();

    reconcileCreateMealPlanItemReplay(
      makeCache(),
      createVariables,
      createdAs(MINTED_ID, 1),
      adopt,
    );

    expect(adopt).not.toHaveBeenCalled();
  });

  // An edit queued behind the create states the minted row's version; the row
  // it now lands on is at its own, and `updateMealPlanItem` refuses a stale one.
  it('moves the writes queued against the minted meal onto the kept one, at its version', () => {
    const adopt = jest.fn();

    reconcileCreateMealPlanItemReplay(
      makeCache(),
      createVariables,
      createdAs(SERVER_ID),
      adopt,
    );

    expect(adopt).toHaveBeenCalledWith({
      mintedId: MINTED_ID,
      survivingId: SERVER_ID,
      version: SERVER_VERSION,
    });
  });
});

describe('a replayed meal delete the server has no row for', () => {
  it('is settled as moot', () => {
    expect(GONE_REPLAYS.DeleteMealPlanItem).toBe(settleGoneMealPlanItem);
  });
});
