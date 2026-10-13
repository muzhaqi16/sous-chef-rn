/**
 * A write the previous build queued replays its STORED document. The API moved
 * between that build and this one, and 29 of its 144 mutations fail validation
 * as stored — every shopping-list add, update and move among them. The fixture
 * holds those 29, taken from that build's persisted-operation manifest; each
 * goes through the queue's own load and has to come out valid.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildSchema, parse, validate } from 'graphql';
import { storage } from '#storage/mmkv';
import { QueueStore } from '../queueStore';
import { QueueStatus } from '../types';
import refusedAsStored from './fixtures/mutationsRefusedAsStored.json';

const schema = buildSchema(
  fs.readFileSync(
    path.resolve(__dirname, '../../../graphql/generated/schema.graphql'),
    'utf8',
  ),
);

const USER_ID = 'user-1';

/** The stored input each retired operation was queued with. */
const STORED_INPUTS: Record<string, Record<string, unknown>> = {
  ToggleShoppingListItemPurchased: { id: 'line-1', purchased: true },
  UpdateShoppingListItemQuantity: {
    itemId: 'line-1',
    quantity: '1 1/2',
    unitId: 'unit-cup',
    version: 4,
  },
  ConfirmRecipeConsumption: {
    id: 'log-1',
    recipeId: 'recipe-1',
    pantryId: 'pantry-1',
    servings: 2,
    notes: 'double garlic',
    consumptions: [
      {
        recipeIngredientId: 'ing-1',
        pantryItemId: 'stack-1',
        quantity: 250,
        unitId: 'unit-g',
      },
    ],
  },
  ConvertExpiredBatchesToWaste: {
    pantryItemId: 'stack-1',
    idempotencyKey: 'key-1',
    today: '2026-10-10',
  },
};

/**
 * Never in a queue: neither was sent `localFirst`, so offline they were
 * refused at the tap. Stated so the fixture's remainder is the whole claim.
 */
const NEVER_QUEUED = new Set([
  'CreateShoppingListItemsFromRecipe',
  'UpdateAccount',
]);

/**
 * Not rewritten: the batch add that replaced it needs the item reference, which
 * the stored input does not carry. Its replay is refused and withdrawn through
 * the reported path.
 */
const WITHDRAWN = new Set(['CreateShoppingListItemFromRecipeIngredient']);

const stored = Object.entries(refusedAsStored);

/** The queue as the previous build left it, loaded by this one. */
function loadedFromStorage(operationName: string, body: string) {
  const document = parse(body, { noLocation: true });
  storage.set(
    'apollo-mutation-queue',
    JSON.stringify({
      v: 2,
      documents: { [operationName]: JSON.stringify(document) },
      entries: [
        {
          id: 'entry-1',
          operationName,
          document: operationName,
          variables: { input: STORED_INPUTS[operationName] ?? { id: 'row-1' } },
          userId: USER_ID,
          status: QueueStatus.PENDING,
          timestamp: Date.now(),
          retryCount: 0,
        },
      ],
    }),
  );
  const [loaded] = new QueueStore().getMutationsForUser(USER_ID);
  if (!loaded) throw new Error(`${operationName} did not load`);
  return loaded;
}

describe('a write stored by the previous build', () => {
  it('covers every mutation of that build the pulled schema refuses', () => {
    expect(stored).toHaveLength(29);
    for (const [, body] of stored) {
      expect(validate(schema, parse(body))).not.toHaveLength(0);
    }
  });

  it.each(
    stored.filter(([name]) => !NEVER_QUEUED.has(name) && !WITHDRAWN.has(name)),
  )('%s validates once the queue has loaded it', (name, body) => {
    const loaded = loadedFromStorage(name, body);

    expect(validate(schema, loaded.mutation).map(e => e.message)).toEqual([]);
  });

  it('replays a tick as an update carrying only the purchased state', () => {
    const loaded = loadedFromStorage(
      'ToggleShoppingListItemPurchased',
      refusedAsStored.ToggleShoppingListItemPurchased,
    );

    expect(loaded.operationName).toBe('UpdateShoppingListItem');
    expect(loaded.variables).toEqual({
      input: {
        id: 'line-1',
        version: 0,
        purchaseTracking: { isPurchased: true },
      },
    });
  });

  it('replays a quantity edit as an update of the same line and unit', () => {
    const loaded = loadedFromStorage(
      'UpdateShoppingListItemQuantity',
      refusedAsStored.UpdateShoppingListItemQuantity,
    );

    expect(loaded.operationName).toBe('UpdateShoppingListItem');
    expect(loaded.variables).toEqual({
      input: {
        id: 'line-1',
        version: 4,
        quantity: '1 1/2',
        unit: { id: 'unit-cup' },
      },
    });
  });

  it('replays a reviewed cook as one cook of exactly its stacks', () => {
    const loaded = loadedFromStorage(
      'ConfirmRecipeConsumption',
      refusedAsStored.ConfirmRecipeConsumption,
    );

    expect(loaded.operationName).toBe('MarkRecipeAsCooked');
    expect(loaded.variables).toEqual({
      input: {
        id: 'log-1',
        recipeId: 'recipe-1',
        pantryId: 'pantry-1',
        deductFromPantry: true,
        exactStacks: true,
        servings: 2,
        notes: 'double garlic',
        ingredientsUsed: [
          {
            recipeIngredientId: 'ing-1',
            pantryItemId: 'stack-1',
            actualQuantity: 250,
            actualUnitId: 'unit-g',
          },
        ],
      },
    });
  });

  it('replays an expired-batches waste as the surviving waste, on the day of the tap', () => {
    const loaded = loadedFromStorage(
      'ConvertExpiredBatchesToWaste',
      refusedAsStored.ConvertExpiredBatchesToWaste,
    );

    expect(loaded.operationName).toBe('ConvertExpiredToWaste');
    expect(loaded.variables.input).toEqual({
      pantryItemId: 'stack-1',
      idempotencyKey: 'key-1',
      today: '2026-10-10',
    });
  });

  it.each([...WITHDRAWN])(
    '%s stays as stored, for its replay to be refused and reported',
    name => {
      const body = Object.fromEntries(stored)[name];
      if (!body) throw new Error(`${name} is not in the fixture`);
      const loaded = loadedFromStorage(name, body);

      expect(loaded.operationName).toBe(name);
      expect(validate(schema, loaded.mutation)).not.toHaveLength(0);
    },
  );
});
