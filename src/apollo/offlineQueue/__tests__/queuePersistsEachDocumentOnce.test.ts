import { ApolloClient, gql } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { print } from 'graphql';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { storage } from '#storage/mmkv';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { QueueManager } from '../queueManager';
import { QueueStore } from '../queueStore';
import type { QueuedMutation } from '../types';

/**
 * The queue stores each distinct document once (blob v2) and still reads the
 * v1 blob an earlier build wrote, where every entry carried its own copy.
 */

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

const QUEUE_STORAGE_KEY = 'apollo-mutation-queue';

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
    QUEUE_STORAGE_KEY,
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
  const json = storage.getString(QUEUE_STORAGE_KEY);
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
