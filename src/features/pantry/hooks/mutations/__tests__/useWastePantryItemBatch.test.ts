import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { WastePantryItemBatchDocument } from '#features/pantry/graphql/pantry.generated';
import {
  BatchStatus,
  ErrorCode,
  WasteReason,
} from '#graphql/generated/schemaTypes';
import { alertService } from '#services/alertService';
import { useWastePantryItemBatch } from '../useWastePantryItemBatch';

beforeEach(() => jest.clearAllMocks());

const READ_BATCH = gql`
  fragment _readWasteState on PantryItemBatch {
    id
    status
  }
`;

const READ_STACK = gql`
  fragment _readWastedStack on PantryItem {
    id
    quantity
    activeBatchCount
  }
`;

// A stack of 5 whose batch of 2 is thrown out.
const seedBatch = () =>
  seedCache([
    {
      __typename: 'PantryItemBatch',
      id: 'batch-1',
      status: BatchStatus.Active,
      quantity: 2,
    },
    {
      __typename: 'PantryItem',
      id: 'stack-1',
      quantity: 5,
      activeBatchCount: 2,
    },
  ]);

const batch = { id: 'batch-1', pantryItemId: 'stack-1', quantity: 2 };
const details = {
  wasteReason: WasteReason.Mold,
  isComposted: false,
  isRecycled: false,
  notes: '',
};

const readStatus = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ status: BatchStatus }>({
    optimistic: true,
    id: 'PantryItemBatch:batch-1',
    fragment: READ_BATCH,
  })?.status;

const readStack = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ quantity: number; activeBatchCount: number }>({
    optimistic: true,
    id: 'PantryItem:stack-1',
    fragment: READ_STACK,
  });

describe('useWastePantryItemBatch (local-first)', () => {
  it('shows the batch wasted and its stack that much less while the waste is queued', async () => {
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
      const promise = result.current.wasteBatch(batch, details);
      // Shown before the mutation settles.
      expect(readStatus(cache)).toBe(BatchStatus.Wasted);
      resolved = await promise;
    });

    expect(resolved).toBe('queued');
    expect(readStatus(cache)).toBe(BatchStatus.Wasted);
    expect(readStack(cache)).toMatchObject({
      quantity: 3,
      activeBatchCount: 1,
    });
  });

  it('puts the batch and its stack back on a rejection', async () => {
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
                code: ErrorCode.ValidationFailed,
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
      resolved = await result.current.wasteBatch(batch, details);
    });

    expect(resolved).toBe('failed');
    expect(readStatus(cache)).toBe(BatchStatus.Active);
    expect(readStack(cache)).toMatchObject({
      quantity: 5,
      activeBatchCount: 2,
    });
    // A union-error payload carries no transport error, so onError never fires —
    // the hook must surface its own alert rather than reverting silently.
    // Localized copy for the field the refusal named (`batchId`), not the
    // server's English "bad batch".
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'That batch is no longer available. Refresh and try again.',
    );
  });
});
