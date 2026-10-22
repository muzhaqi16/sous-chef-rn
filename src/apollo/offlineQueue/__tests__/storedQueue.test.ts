/**
 * The queue stores each entry without its document and reads it back as THIS
 * build's document for its operation, with its variables as stored.
 */
import { gql } from '@apollo/client';
import { storage } from '#/store/deviceStorage';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { MUTATION_DOCUMENTS } from '#/graphql/generated/mutationDocuments.generated';
import { authoredMutations } from '#/test-utils/queueableOperations';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { QueueStore } from '../queueStore';

const QUEUE_KEY = 'apollo-mutation-queue';

// The same operation as this build's, with a narrower selection.
const NARROWER_CREATE_PANTRY_ITEM = gql`
  mutation CreatePantryItem($input: CreatePantryItemInput!) {
    createPantryItem(input: $input) {
      __typename
    }
  }
`;

const readBlob = (): unknown => {
  const json = storage.getString(QUEUE_KEY);
  if (json === undefined) throw new Error('the queue wrote no blob');
  return JSON.parse(json);
};

beforeEach(() => {
  storage.clearAll();
});

describe('this build’s mutation documents', () => {
  it('name every mutation the app declares, each under its own operation', () => {
    expect(Object.keys(MUTATION_DOCUMENTS).sort()).toEqual(
      [...authoredMutations().keys()].sort(),
    );
    for (const [name, documentOf] of Object.entries(MUTATION_DOCUMENTS)) {
      expect(operationNameOf(documentOf())).toBe(name);
    }
  });
});

describe('the stored queue', () => {
  it('stores each entry without its document', () => {
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

    const blob = readBlob() as { v: number; entries: object[] };
    expect(blob.v).toBe(3);
    expect(blob.entries).toHaveLength(60);
    expect(blob.entries.every(entry => !('mutation' in entry))).toBe(true);
  });

  it('reads an entry back as this build’s document, with its variables as stored', () => {
    const store = new QueueStore();
    const variables = { input: { pantryId: 'p-1' }, today: '2026-10-06' };
    store.addMutation(
      makeQueuedMutation({
        id: 'create-1',
        ...queuedMutationFor(NARROWER_CREATE_PANTRY_ITEM),
        variables,
      }),
    );

    store.invalidateCache();
    const reloaded = store.getMutation('create-1');

    expect(reloaded?.mutation).toBe(CreatePantryItemDocument);
    expect(reloaded?.variables).toEqual(variables);
  });

  it('drops an entry under an operation this build does not declare', () => {
    const store = new QueueStore();
    store.addMutation(
      makeQueuedMutation({ id: 'retired', operationName: 'RetiredOperation' }),
    );
    store.addMutation(
      makeQueuedMutation({
        id: 'restock-1',
        ...queuedMutationFor(RestockPantryItemDocument),
      }),
    );

    store.invalidateCache();

    expect(store.getMutationsForUser('user-1').map(m => m.id)).toEqual([
      'restock-1',
    ]);
  });
});
