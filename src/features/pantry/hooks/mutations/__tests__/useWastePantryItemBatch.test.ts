import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { WastePantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { useWastePantryItemBatch } from '../useWastePantryItemBatch';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

const READ_BATCH = gql`
  fragment _readWasteState on PantryItemBatch {
    id
    status
  }
`;

const seedBatch = () =>
  seedCache([
    {
      __typename: 'PantryItemBatch',
      id: 'batch-1',
      status: BatchStatus.Active,
    },
  ]);

const readStatus = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ status: BatchStatus }>({
    id: 'PantryItemBatch:batch-1',
    fragment: READ_BATCH,
  })?.status;

describe('useWastePantryItemBatch (local-first)', () => {
  it('marks the batch WASTED PERMANENTLY before settle; a queued (null) result keeps it', async () => {
    const cache = seedBatch();
    const { result } = renderHookWithApollo(() => useWastePantryItemBatch(), {
      cache,
      operationMocks: [
        {
          request: {
            query: WastePantryItemBatchDocument,
            variables: () => true,
          },
          // Offline-queued signature: top-level field null, no error.
          result: { data: { wastePantryItemBatch: null } },
        },
      ],
    });

    let resolved: unknown = 'unset';
    await act(async () => {
      const promise = result.current.wasteBatch('batch-1');
      // Synchronous permanent write — visible before the mutation settles.
      expect(readStatus(cache)).toBe(BatchStatus.Wasted);
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    expect(readStatus(cache)).toBe(BatchStatus.Wasted);
  });

  it('reverts the batch status on a rejection', async () => {
    const cache = seedBatch();
    const { result } = renderHookWithApollo(() => useWastePantryItemBatch(), {
      cache,
      operationMocks: [
        {
          request: {
            query: WastePantryItemBatchDocument,
            variables: () => true,
          },
          result: {
            data: {
              wastePantryItemBatch: {
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
      resolved = await result.current.wasteBatch('batch-1');
    });

    expect(resolved).toBe(false);
    expect(readStatus(cache)).toBe(BatchStatus.Active);
    // A union-error payload carries no transport error, so onError never fires —
    // the hook must surface its own alert rather than reverting silently.
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Could not mark this as wasted.',
    );
  });
});
