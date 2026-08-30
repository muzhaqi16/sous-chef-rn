import React, { type ReactNode } from 'react';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { renderHook, act } from '@testing-library/react-native';
import { ApolloClient, ApolloLink } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { ConvertExpiredBatchesToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { alertService } from '#/services/alertService';
import { useConvertExpiredBatchesToWaste } from '../useConvertExpiredBatchesToWaste';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

/**
 * Render the hook against a real link chain so the mutation `context` and
 * `variables` can be captured off the operation. A leading tap link records
 * `getContext()` (plus the operation `variables`, where the idempotencyKey now
 * lives) for the convert op, then forwards to a `MockLink` serving the supplied
 * responses.
 */
function renderConvert(
  mocks: MockedResponse[],
  capturedContexts: Array<Record<string, unknown>>,
  onSuccess?: () => void,
) {
  const tapLink = new ApolloLink((operation, forward) => {
    if (operation.operationName === 'ConvertExpiredBatchesToWaste') {
      capturedContexts.push({
        ...operation.getContext(),
        variables: operation.variables,
      });
    }
    return forward(operation);
  });
  const client = new ApolloClient({
    // The production cache, so the hook runs against the engine the app ships.
    cache: makeCache(),
    link: ApolloLink.from([tapLink, new MockLink(mocks)]),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(ApolloProvider, { client, children });
  return renderHook(() => useConvertExpiredBatchesToWaste({ onSuccess }), {
    wrapper,
  });
}

describe('useConvertExpiredBatchesToWaste (local-first)', () => {
  it('fires with localFirst + input.idempotencyKey and treats a queued (null) result as success', async () => {
    const contexts: Array<Record<string, unknown>> = [];
    const onSuccess = jest.fn();
    const { result } = renderConvert(
      [
        {
          request: {
            query: ConvertExpiredBatchesToWasteDocument,
            variables: () => true,
          },
          // Offline-queued signature: top-level field null, no error.
          result: { data: { convertExpiredBatchesToWaste: null } },
        },
      ],
      contexts,
      onSuccess,
    );

    let resolved: unknown = 'unset';
    await act(async () => {
      resolved = await result.current.convertExpiredBatches('item-1');
    });

    expect(resolved).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    // Fired with localFirst + a non-empty input.idempotencyKey (the server
    // dedups the replay on it; operationId is unused).
    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.localFirst).toBe(true);
    expect(contexts[0]?.operationId).toBeUndefined();
    const vars = contexts[0]?.variables as {
      input?: { idempotencyKey?: string };
    };
    expect(typeof vars.input?.idempotencyKey).toBe('string');
    expect((vars.input?.idempotencyKey as string).length).toBeGreaterThan(0);
  });

  it('alerts and returns false on a rejection (error-union result)', async () => {
    const contexts: Array<Record<string, unknown>> = [];
    const onSuccess = jest.fn();
    const { result } = renderConvert(
      [
        {
          request: {
            query: ConvertExpiredBatchesToWasteDocument,
            variables: () => true,
          },
          result: {
            data: {
              convertExpiredBatchesToWaste: {
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
      onSuccess,
    );

    let resolved: unknown = 'unset';
    await act(async () => {
      resolved = await result.current.convertExpiredBatches('item-1');
    });

    expect(resolved).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    // A union-error payload carries no transport error, so onError never fires —
    // the hook must surface its own alert.
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to discard expired items',
    );
  });
});
