/**
 * A queued write replays as the canonical mutation it was queued as. What the
 * replay restates is only what the device knows better by then: the unit a
 * vocabulary repair retired, a create that may land on a held stack, and the
 * day totals are counted on.
 */
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import {
  AdjustPantryItemQuantityDocument,
  CreatePantryItemDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import { BarcodeCreatePantryItemDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import {
  AddItemToShoppingListDocument,
  MoveShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { todayKey } from '#/utils/dateUtils';
import type { DocumentNode } from 'graphql';
import type { QueuedMutation } from '#/apollo/offlineQueue/types';
import {
  captureReplayInputs,
  hasReplayPreparation,
  prepareReplay,
} from '#/apollo/offlineQueue/prepareReplay';

type Cache = ReturnType<typeof makeCache>;

const UNIT = gql`
  fragment PrepareReplayTestUnit on Unit {
    id
    symbol
  }
`;

const cacheWithUnit = (id: string, symbol: string): Cache => {
  const cache = makeCache();
  cache.writeFragment({
    fragment: UNIT,
    data: { __typename: 'Unit', id, symbol },
  });
  return cache;
};

const queued = (
  document: DocumentNode,
  variables: QueuedMutation['variables'],
  overrides: Partial<QueuedMutation> = {},
) =>
  makeQueuedMutation({
    ...queuedMutationFor(document),
    variables,
    ...overrides,
  });

const prepare = (
  mutation: QueuedMutation,
  cache: Cache = makeCache(),
  {
    unitsRefreshed = false,
    unitIdForSymbol = jest.fn(async () => undefined),
  }: {
    unitsRefreshed?: boolean;
    unitIdForSymbol?: (symbol: string) => Promise<string | undefined>;
  } = {},
) => prepareReplay(mutation, { cache, unitsRefreshed, unitIdForSymbol });

describe('prepareReplay', () => {
  it('replays an unregistered write exactly as queued', async () => {
    const variables = {
      input: { pantryItemId: 'row-1', delta: 2, idempotencyKey: 'key-1' },
    };

    await expect(
      prepare(queued(AdjustPantryItemQuantityDocument, variables)),
    ).resolves.toEqual({ ...variables, today: todayKey() });
    expect(
      hasReplayPreparation(operationNameOf(AdjustPantryItemQuantityDocument)),
    ).toBe(false);
  });

  it('counts totals on the day the replay runs, not the day it was queued', async () => {
    const replayed = await prepare(
      queued(UpdatePantryItemDocument, {
        input: { id: 'row-1', itemName: 'Oat milk', version: 2 },
        today: '2026-01-01',
      }),
    );

    expect(replayed.today).toBe(todayKey());
  });

  it('adds no day to a document that declares none', async () => {
    const replayed = await prepare(
      queued(MoveShoppingListItemDocument, {
        input: { itemId: 'row-1', afterItemId: 'row-0' },
      }),
    );

    expect(replayed).not.toHaveProperty('today');
  });

  describe('units', () => {
    it('names a unit by its cached symbol, which outlives a retired id', async () => {
      const replayed = await prepare(
        queued(UpdatePantryItemDocument, {
          input: { id: 'row-1', unit: { id: 'unit-1' }, version: 2 },
        }),
        cacheWithUnit('unit-1', 'tbsp'),
      );

      expect(replayed.input).toMatchObject({ unit: { symbol: 'tbsp' } });
    });

    it('restates every line of a batch add', async () => {
      const replayed = await prepare(
        queued(AddItemToShoppingListDocument, {
          input: {
            shoppingListId: 'list-1',
            items: [
              { id: 'row-1', unit: { id: 'unit-1' } },
              { id: 'row-2', unit: { name: 'handful' } },
            ],
          },
        }),
        cacheWithUnit('unit-1', 'tbsp'),
      );

      expect(replayed.input).toMatchObject({
        items: [{ unit: { symbol: 'tbsp' } }, { unit: { name: 'handful' } }],
      });
    });

    it('sends the symbol captured when queued once the unit left the cache', async () => {
      const mutation = queued(UpdatePantryItemDocument, {
        input: { id: 'row-1', unit: { id: 'unit-1' }, version: 2 },
      });
      mutation.replayInputs = captureReplayInputs(
        mutation,
        cacheWithUnit('unit-1', 'tbsp'),
      );

      const replayed = await prepare(mutation);

      expect(mutation.replayInputs).toEqual({ 'unit:unit-1': 'tbsp' });
      expect(replayed.input).toMatchObject({ unit: { symbol: 'tbsp' } });
    });

    it('keeps the id when no symbol is known', async () => {
      const replayed = await prepare(
        queued(UpdatePantryItemDocument, {
          input: { id: 'row-1', unit: { id: 'unit-1' }, version: 2 },
        }),
      );

      expect(replayed.input).toMatchObject({ unit: { id: 'unit-1' } });
    });

    it('re-resolves a flat unit id only after a refusal named it retired', async () => {
      const mutation = queued(UpdatePantryItemQuantityDocument, {
        input: { pantryItemId: 'row-1', quantity: '2', unitId: 'unit-old' },
      });
      const cache = cacheWithUnit('unit-old', 'tbsp');
      const unitIdForSymbol = jest.fn(async (symbol: string) =>
        symbol === 'tbsp' ? 'unit-new' : undefined,
      );

      const first = await prepare(mutation, cache, { unitIdForSymbol });
      const retry = await prepare(mutation, cache, {
        unitsRefreshed: true,
        unitIdForSymbol,
      });

      expect(first.input).toMatchObject({ unitId: 'unit-old' });
      expect(retry.input).toMatchObject({ unitId: 'unit-new' });
      expect(unitIdForSymbol).toHaveBeenCalledTimes(1);
    });

    it('captures nothing for a write the queue replays without preparing', () => {
      const mutation = queued(AdjustPantryItemQuantityDocument, {
        input: { pantryItemId: 'row-1', unitId: 'unit-1' },
      });

      expect(
        captureReplayInputs(mutation, cacheWithUnit('unit-1', 'tbsp')),
      ).toBeUndefined();
    });
  });

  describe('a pantry create', () => {
    it.each([CreatePantryItemDocument, BarcodeCreatePantryItemDocument])(
      'lands on a stack another member added meanwhile (%#)',
      async document => {
        const replayed = await prepare(
          queued(document, {
            input: {
              id: 'row-1',
              pantryId: 'pantry-1',
              item: { inline: { name: 'Milk' } },
              quantity: 1,
            },
          }),
        );

        expect(replayed.input).toMatchObject({ id: 'row-1', forceAdd: true });
      },
    );

    it('leaves an update to the stack it names', async () => {
      const replayed = await prepare(
        queued(UpdatePantryItemDocument, {
          input: { id: 'row-1', itemName: 'Oat milk', version: 2 },
        }),
      );

      expect(replayed.input).not.toHaveProperty('forceAdd');
    });
  });
});
