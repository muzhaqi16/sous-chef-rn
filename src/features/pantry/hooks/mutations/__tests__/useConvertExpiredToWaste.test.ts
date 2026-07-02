import React, { type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { gql, ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { seedCache } from '#/test-utils/apolloMockProvider';
import { ConvertExpiredToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { ItemCondition } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { useConvertExpiredToWaste } from '../useConvertExpiredToWaste';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

const READ_STATE = gql`
  fragment _readConvertState on PantryItem {
    id
    quantity
    condition
  }
`;

const seedItem = () =>
  seedCache([
    {
      __typename: 'PantryItem',
      id: 'item-1',
      quantity: 4,
      condition: ItemCondition.Good,
    },
  ]);

const readState = (cache: InMemoryCache) =>
  cache.readFragment<{ quantity: number; condition: ItemCondition }>({
    id: 'PantryItem:item-1',
    fragment: READ_STATE,
  });

/**
 * Render the hook against a real link chain so the mutation `context` and
 * `variables` can be captured off the operation. A leading tap link records
 * `getContext()` (plus the operation `variables`, where the idempotencyKey now
 * lives) for the convert op, then forwards to a `MockLink` serving the supplied
 * responses.
 */
function renderConvert(
  cache: InMemoryCache,
  mocks: MockedResponse[],
  capturedContexts: Array<Record<string, unknown>>,
) {
  const tapLink = new ApolloLink((operation, forward) => {
    if (operation.operationName === 'ConvertExpiredToWaste') {
      capturedContexts.push({
        ...operation.getContext(),
        variables: operation.variables,
      });
    }
    return forward(operation);
  });
  const client = new ApolloClient({
    cache,
    link: ApolloLink.from([tapLink, new MockLink(mocks)]),
    defaultOptions: { mutate: { errorPolicy: 'all' } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(ApolloProvider, { client, children });
  return renderHook(() => useConvertExpiredToWaste(), { wrapper });
}

describe('useConvertExpiredToWaste (local-first)', () => {
  it('optimistically sets quantity 0 + SPOILED before settle, fires with localFirst + input.idempotencyKey, and a queued (null) result keeps it', async () => {
    const cache = seedItem();
    const contexts: Array<Record<string, unknown>> = [];
    const { result } = renderConvert(
      cache,
      [
        {
          request: {
            query: ConvertExpiredToWasteDocument,
            variables: () => true,
          },
          // Offline-queued signature: top-level field null, no error.
          result: { data: { convertExpiredToWaste: null } },
        },
      ],
      contexts,
    );

    let resolved: unknown = 'unset';
    await act(async () => {
      const promise = result.current.convertExpiredToWaste('item-1');
      // Synchronous permanent write — visible before the mutation settles.
      expect(readState(cache)).toMatchObject({
        quantity: 0,
        condition: ItemCondition.Spoiled,
      });
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    // Queued result keeps the optimistic state for replay.
    expect(readState(cache)).toMatchObject({
      quantity: 0,
      condition: ItemCondition.Spoiled,
    });

    // Fired with localFirst + a non-empty input.idempotencyKey (the server
    // dedups the replay on it; operationId is no longer used).
    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.localFirst).toBe(true);
    expect(contexts[0]?.operationId).toBeUndefined();
    const vars = contexts[0]?.variables as {
      input?: { idempotencyKey?: string };
    };
    expect(typeof vars.input?.idempotencyKey).toBe('string');
    expect((vars.input?.idempotencyKey as string).length).toBeGreaterThan(0);
  });

  it('reverts quantity + condition on a rejection (error-union result)', async () => {
    const cache = seedItem();
    const contexts: Array<Record<string, unknown>> = [];
    const { result } = renderConvert(
      cache,
      [
        {
          request: {
            query: ConvertExpiredToWasteDocument,
            variables: () => true,
          },
          result: {
            data: {
              convertExpiredToWaste: {
                __typename: 'NotFoundError',
                code: 'NOT_FOUND',
                message: 'Pantry item not found',
                resource: 'PantryItem',
                resourceId: 'item-1',
              },
            },
          },
        },
      ],
      contexts,
    );

    let resolved: unknown = 'unset';
    await act(async () => {
      resolved = await result.current.convertExpiredToWaste('item-1');
    });

    expect(resolved).toBe(false);
    expect(readState(cache)).toMatchObject({
      quantity: 4,
      condition: ItemCondition.Good,
    });
    // A union-error payload carries no transport error, so onError never fires —
    // the hook must surface its own alert rather than reverting silently.
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to remove item',
    );
  });
});
