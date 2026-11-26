import { makeCache } from '#apollo/cache';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { RecordPantryStockCheckDocument } from '#features/pantry/hooks/useStockCheck.generated';
import { retryStockCheckAsItStands } from '../replayPreparers';

const queued = (overwrites: boolean) =>
  makeQueuedMutation({
    ...queuedMutationFor(RecordPantryStockCheckDocument),
    overwrites,
    variables: {
      today: '2026-11-25',
      input: {
        pantryId: 'pantry-1',
        idempotencyKey: 'own-key',
        entries: [
          { pantryItemId: 'eggs', answer: 'ALL_GONE', expectedVersion: 5 },
        ],
      },
    },
  });

const context = {
  cache: makeCache(),
  unitsRefreshed: false,
  unitIdForSymbol: () => Promise.resolve(undefined),
};

describe('a refused stock check', () => {
  // The person was told the stack changed and chose to send their count anyway.
  it('retried by the person, applies to each stack as it stands', async () => {
    const variables = await retryStockCheckAsItStands(queued(true), context);

    expect(variables.input).toEqual({
      pantryId: 'pantry-1',
      idempotencyKey: 'own-key',
      entries: [{ pantryItemId: 'eggs', answer: 'ALL_GONE' }],
    });
  });

  it('replayed on its own, keeps the version the household saw', async () => {
    const variables = await retryStockCheckAsItStands(queued(false), context);

    expect(variables.input).toMatchObject({
      entries: [{ pantryItemId: 'eggs', expectedVersion: 5 }],
    });
  });
});
