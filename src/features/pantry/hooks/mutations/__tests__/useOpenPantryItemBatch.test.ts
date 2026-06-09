import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { OpenPantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { useOpenPantryItemBatch } from '../useOpenPantryItemBatch';

const READ_BATCH = gql`
  fragment _readOpenState on PantryItemBatch {
    id
    isOpened
    openedAt
  }
`;

const seedBatch = () =>
  seedCache([
    {
      __typename: 'PantryItemBatch',
      id: 'batch-1',
      isOpened: false,
      openedAt: null,
    },
  ]);

const readIsOpened = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ isOpened: boolean }>({
    id: 'PantryItemBatch:batch-1',
    fragment: READ_BATCH,
  })?.isOpened;

describe('useOpenPantryItemBatch (local-first)', () => {
  it('writes isOpened PERMANENTLY before settle; a queued (null) result keeps it', async () => {
    const cache = seedBatch();
    const { result } = renderHookWithApollo(() => useOpenPantryItemBatch(), {
      cache,
      operationMocks: [
        {
          request: {
            query: OpenPantryItemBatchDocument,
            variables: () => true,
          },
          // Offline-queued signature: top-level field null, no error.
          result: { data: { openPantryItemBatch: null } },
        },
      ],
    });

    let resolved: unknown = 'unset';
    await act(async () => {
      const promise = result.current.openBatch('batch-1');
      // Synchronous permanent write — visible before the mutation settles.
      expect(readIsOpened(cache)).toBe(true);
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    expect(readIsOpened(cache)).toBe(true);
  });

  it('reverts isOpened on a rejection', async () => {
    const cache = seedBatch();
    const { result } = renderHookWithApollo(() => useOpenPantryItemBatch(), {
      cache,
      operationMocks: [
        {
          request: {
            query: OpenPantryItemBatchDocument,
            variables: () => true,
          },
          result: {
            data: {
              openPantryItemBatch: {
                __typename: 'ValidationError',
                code: 'VALIDATION',
                message: 'bad batch',
                field: 'batchId',
              },
            },
          },
        },
      ],
    });

    let resolved: unknown = 'unset';
    await act(async () => {
      resolved = await result.current.openBatch('batch-1');
    });

    expect(resolved).toBe(false);
    expect(readIsOpened(cache)).toBe(false);
  });
});
