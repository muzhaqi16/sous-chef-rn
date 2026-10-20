/**
 * A write the previous build queued replays its STORED document. The API moved
 * between that build and this one, and 29 of its 144 mutations fail validation
 * as stored — every shopping-list add, update and move among them. The fixture
 * holds those 29, taken from that build's persisted-operation manifest; each
 * goes through the queue's own load and has to come out valid.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ApolloClient, gql, type DocumentNode } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { buildSchema, parse, print, validate } from 'graphql';
import { storage } from '#/store/deviceStorage';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import {
  completeMockedResponse,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { QueueManager } from '../queueManager';
import { QueueStore } from '../queueStore';
import { QueueStatus, type QueuedMutation } from '../types';
import refusedAsStored from './fixtures/mutationsRefusedAsStored.json';

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  requireApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

const schema = buildSchema(
  fs.readFileSync(
    path.resolve(__dirname, '../../../graphql/generated/schema.graphql'),
    'utf8',
  ),
);

const USER_ID = 'user-1';
const QUEUE_KEY = 'apollo-mutation-queue';

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
const storedBodies: Record<string, string> = refusedAsStored;

const storedBody = (name: string) => {
  const body = storedBodies[name];
  if (!body) throw new Error(`${name} is not in the fixture`);
  return body;
};

/** The queue as the previous build left it: one pending write of `document`. */
function storeQueued(
  operationName: string,
  document: DocumentNode,
  input: Record<string, unknown>,
) {
  storage.set(
    QUEUE_KEY,
    JSON.stringify({
      v: 2,
      documents: { [operationName]: JSON.stringify(document) },
      entries: [
        {
          id: 'entry-1',
          operationName,
          document: operationName,
          variables: { input },
          userId: USER_ID,
          status: QueueStatus.PENDING,
          timestamp: Date.now(),
          retryCount: 0,
        },
      ],
    }),
  );
}

/** That queue, loaded by this build. */
function loadedFromStorage(operationName: string, body: string) {
  storeQueued(
    operationName,
    parse(body, { noLocation: true }),
    STORED_INPUTS[operationName] ?? { id: 'row-1' },
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

  it.each([
    [
      'replays a tick as an update carrying only the purchased state',
      'ToggleShoppingListItemPurchased',
      'UpdateShoppingListItem',
      { id: 'line-1', version: 0, purchaseTracking: { isPurchased: true } },
    ],
    [
      'replays a quantity edit as an update of the same line and unit',
      'UpdateShoppingListItemQuantity',
      'UpdateShoppingListItem',
      {
        id: 'line-1',
        version: 4,
        quantity: '1 1/2',
        unit: { id: 'unit-cup' },
      },
    ],
    [
      'replays a reviewed cook as one cook of exactly its stacks',
      'ConfirmRecipeConsumption',
      'MarkRecipeAsCooked',
      {
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
    ],
    [
      'replays an expired-batches waste as the surviving waste, on the day of the tap',
      'ConvertExpiredBatchesToWaste',
      'ConvertExpiredToWaste',
      { pantryItemId: 'stack-1', idempotencyKey: 'key-1', today: '2026-10-10' },
    ],
  ])('%s', (_, storedName, replayedName, input) => {
    const loaded = loadedFromStorage(storedName, storedBody(storedName));

    expect(loaded.operationName).toBe(replayedName);
    expect(loaded.variables).toEqual({ input });
  });

  it.each([...WITHDRAWN])(
    '%s stays as stored, for its replay to be refused and reported',
    name => {
      const loaded = loadedFromStorage(name, storedBody(name));

      expect(loaded.operationName).toBe(name);
      expect(validate(schema, loaded.mutation)).not.toHaveLength(0);
    },
  );
});

/**
 * A typed name the previous build queued as `itemName`, which the API removes:
 * the load sends it `inline`, under an item id minted then.
 */
describe('a list add the previous build queued with a typed name', () => {
  const addOperation = operationNameOf(AddItemToShoppingListDocument);

  function storedWithItemName() {
    storeQueued(addOperation, AddItemToShoppingListDocument, {
      shoppingListId: 'list-1',
      items: [{ id: 'line-1', item: { itemName: 'Milk' } }],
    });
  }

  afterEach(() => {
    mockClient = null;
  });

  it('loads sending the name inline, under a minted item id', () => {
    storedWithItemName();

    const [loaded] = new QueueStore().getMutationsForUser(USER_ID);

    expect(loaded?.variables).toEqual({
      input: {
        shoppingListId: 'list-1',
        items: [
          {
            id: 'line-1',
            item: { inline: { id: expect.any(String), name: 'Milk' } },
          },
        ],
      },
    });
  });

  it('keeps that id through the save before its first send, and replays it once', async () => {
    storedWithItemName();
    const store = new QueueStore();
    const [loaded] = store.getMutationsForUser(USER_ID);
    if (!loaded) throw new Error('the stored add did not load');

    // What the queue writes before it sends an entry.
    store.updateMutation(loaded.id, { status: QueueStatus.PROCESSING });
    const [reloaded] = new QueueStore().getMutationsForUser(USER_ID);
    if (!reloaded) throw new Error('the saved add did not reload');
    expect(reloaded.variables).toEqual(loaded.variables);

    const add = recordMock(AddItemToShoppingListDocument, {
      data: {
        addItemsToShoppingList: {
          __typename: 'AddItemsToShoppingListPayload',
          results: [{ index: 0, success: true, item: { id: 'line-1' } }],
        },
      },
    });
    mockClient = new ApolloClient({
      cache: makeCache(),
      dataMasking: true,
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
      link: new MockLink([completeMockedResponse(add.mock)]),
    });

    await new QueueManager()['executeMutation'](reloaded);

    expect(add.fired).toEqual([loaded.variables]);
  });
});

/**
 * The queue stores each distinct document once (blob v2) and still reads the
 * v1 blob an earlier build wrote, where every entry carried its own copy.
 */
describe('the stored queue blob', () => {
  // An operation an earlier build queued and this build has no document for.
  const RETIRED_UPDATE_RECIPE_INGREDIENTS = gql`
    mutation UpdateRecipeIngredients($input: UpdateRecipeIngredientsInput!) {
      updateRecipeIngredients(input: $input) {
        __typename
        ... on UpdateRecipeIngredientsPayload {
          recipe {
            id
          }
        }
        ... on Error {
          code
          message
        }
      }
    }
  `;

  interface QueueBlobV2 {
    v: number;
    documents: Record<string, string>;
    entries: Array<{ document: string }>;
  }

  /** What a build before blob v2 wrote: each entry with its own document string. */
  function writeV1Blob(entries: QueuedMutation[]): void {
    storage.set(
      QUEUE_KEY,
      JSON.stringify(
        entries.map(entry => ({
          ...entry,
          mutation: JSON.stringify({
            kind: entry.mutation.kind,
            definitions: entry.mutation.definitions,
            loc: entry.mutation.loc,
          }),
        })),
      ),
    );
  }

  function readBlob(): unknown {
    const json = storage.getString(QUEUE_KEY);
    if (json === undefined) throw new Error('the queue wrote no blob');
    return JSON.parse(json);
  }

  function readV2Blob(): QueueBlobV2 {
    const blob = readBlob();
    expect(blob).toMatchObject({ v: 2 });
    return blob as QueueBlobV2;
  }

  const retiredEntry = makeQueuedMutation({
    id: 'queued-by-older-build',
    ...queuedMutationFor(RETIRED_UPDATE_RECIPE_INGREDIENTS),
    variables: { input: { recipeId: 'recipe-1', ingredients: [] } },
  });

  beforeEach(() => {
    storage.clearAll();
    mockClient = null;
  });

  it('reads a v1 blob, writes v2 on the next save, and reads that back unchanged', () => {
    writeV1Blob([
      makeQueuedMutation({
        id: 'create-1',
        ...queuedMutationFor(CreatePantryItemDocument),
        variables: { input: { pantryId: 'p-1' }, today: '2026-10-06' },
      }),
      makeQueuedMutation({
        id: 'create-2',
        ...queuedMutationFor(CreatePantryItemDocument),
        variables: { input: { pantryId: 'p-2' }, today: '2026-10-06' },
      }),
      retiredEntry,
    ]);
    expect(Array.isArray(readBlob())).toBe(true);

    const store = new QueueStore();
    const fromV1 = store.getMutationsForUser('user-1');
    expect(fromV1.map(m => m.id)).toEqual([
      'create-1',
      'create-2',
      'queued-by-older-build',
    ]);
    expect(fromV1.map(m => print(m.mutation))).toEqual([
      print(CreatePantryItemDocument),
      print(CreatePantryItemDocument),
      print(RETIRED_UPDATE_RECIPE_INGREDIENTS),
    ]);

    store.updateMutation('create-2', { retryCount: 1 });

    const blob = readV2Blob();
    expect(Object.keys(blob.documents)).toHaveLength(2);
    expect(blob.entries).toHaveLength(3);

    expect(new QueueStore().getMutationsForUser('user-1')).toEqual(
      store.getMutationsForUser('user-1'),
    );
  });

  it('keeps a document from an older build across the v1 to v2 rewrite and replays it', async () => {
    writeV1Blob([retiredEntry]);
    new QueueStore().addMutation(
      makeQueuedMutation({
        id: 'restock-1',
        ...queuedMutationFor(RestockPantryItemDocument),
      }),
    );
    expect(readV2Blob().entries).toHaveLength(2);

    const reloaded = new QueueStore().getMutation('queued-by-older-build');
    if (!reloaded) throw new Error('the older build entry was not reloaded');
    expect(reloaded.operationName).toBe('UpdateRecipeIngredients');
    expect(print(reloaded.mutation)).toBe(
      print(RETIRED_UPDATE_RECIPE_INGREDIENTS),
    );

    mockClient = new ApolloClient({
      cache: makeCache(),
      dataMasking: true,
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
      // Answers only the document the older build stored.
      link: new MockLink([
        {
          request: {
            query: RETIRED_UPDATE_RECIPE_INGREDIENTS,
            variables: { input: { recipeId: 'recipe-1', ingredients: [] } },
          },
          result: {
            data: {
              updateRecipeIngredients: {
                __typename: 'UpdateRecipeIngredientsPayload',
                recipe: { __typename: 'Recipe', id: 'recipe-1' },
              },
            },
          },
        },
      ]),
    });

    await expect(
      new QueueManager()['executeMutation'](reloaded),
    ).resolves.toMatchObject({
      updateRecipeIngredients: { __typename: 'UpdateRecipeIngredientsPayload' },
    });
  });

  it('stores 60 queued entries of two operations as two documents', () => {
    const store = new QueueStore();
    for (let index = 0; index < 60; index += 1) {
      store.addMutation(
        makeQueuedMutation({
          id: `line-${index}`,
          ...queuedMutationFor(
            index % 2 === 0
              ? CreatePantryItemDocument
              : RestockPantryItemDocument,
          ),
          variables: { input: { pantryId: 'p-1' } },
        }),
      );
    }

    const blob = readV2Blob();
    expect(Object.keys(blob.documents)).toHaveLength(2);
    expect(blob.entries).toHaveLength(60);
    expect(blob.entries.every(entry => entry.document in blob.documents)).toBe(
      true,
    );

    const reloaded = new QueueStore().getMutationsForUser('user-1');
    expect(reloaded).toHaveLength(60);
    const [create, restock] = reloaded;
    if (!create || !restock) throw new Error('the queue lost its entries');
    expect(print(create.mutation)).toBe(print(CreatePantryItemDocument));
    expect(print(restock.mutation)).toBe(print(RestockPantryItemDocument));
    // Entries naming one stored document share one parsed object.
    expect(
      reloaded.every(
        (entry, index) =>
          entry.mutation === (index % 2 === 0 ? create : restock).mutation,
      ),
    ).toBe(true);
  });
});
