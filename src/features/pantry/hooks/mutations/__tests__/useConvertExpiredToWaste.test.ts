import { t } from '#/i18n';
import React, { type ReactNode } from 'react';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { renderHook, act } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import { gql, ApolloClient, ApolloLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import type {
  MockDataFor,
  MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  completeMockedResponse,
  recordMock,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  ConvertExpiredToWasteDocument,
  GetPantryItemBatchesDocument,
} from '#features/pantry/graphql/pantry.generated';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { ItemCondition, ErrorCode } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { todayKey } from '#/utils/dateUtils';
import { useConvertExpiredToWaste } from '../useConvertExpiredToWaste';

beforeEach(() => {
  jest.clearAllMocks();
});

const READ_STATE = gql`
  fragment _readConvertState on PantryItem {
    id
    quantity
    heldQuantity
    condition
  }
`;

const SEEDED_STATE = {
  quantity: 4,
  heldQuantity: 4,
  condition: ItemCondition.Good,
};

const seedItem = () =>
  seedCache([{ __typename: 'PantryItem', id: 'item-1', ...SEEDED_STATE }]);

const readState = (cache: InMemoryCache) =>
  cache.readFragment<{
    quantity: number;
    heldQuantity: number;
    condition: ItemCondition;
  }>({ optimistic: true, id: 'PantryItem:item-1', fragment: READ_STATE });

type ConvertData = MockDataFor<typeof ConvertExpiredToWasteDocument>;

const convertMock = (data: ConvertData) =>
  recordMock(ConvertExpiredToWasteDocument, { data }).mock;

// Offline-queued signature: top-level field null, no error.
const QUEUED: ConvertData = { convertExpiredToWaste: null };

const NOT_FOUND: ConvertData = {
  convertExpiredToWaste: {
    __typename: 'NotFoundError',
    code: ErrorCode.NotFound,
    message: 'Pantry item not found',
    resource: 'PantryItem',
    resourceId: 'item-1',
  },
};

interface CapturedOperation {
  context: Record<string, unknown>;
  variables: Record<string, unknown>;
}

/**
 * Render the hook against a real link chain so the mutation `context` and
 * `variables` can be captured off the operation: a leading tap link records
 * both for the convert op, then forwards to a `MockLink` serving the supplied
 * responses.
 */
function renderConvert(cache: InMemoryCache, mocks: MockedResponse[]) {
  const fired: CapturedOperation[] = [];
  const onSuccess = jest.fn();
  const tapLink = new ApolloLink((operation, forward) => {
    if (
      operation.operationName === operationNameOf(ConvertExpiredToWasteDocument)
    ) {
      fired.push({
        context: operation.getContext(),
        variables: operation.variables,
      });
    }
    return forward(operation);
  });
  const client = new ApolloClient({
    cache,
    link: ApolloLink.from([
      tapLink,
      new MockLink(mocks.map(completeMockedResponse)),
    ]),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(ApolloProvider, { client, children });
  const rendered = renderHook(() => useConvertExpiredToWaste({ onSuccess }), {
    wrapper,
  });
  return { ...rendered, fired, onSuccess };
}

/** The one request the convert sent: local-first, keyed, dated at the tap. */
function expectConvertSent(fired: CapturedOperation[]) {
  expect(fired).toHaveLength(1);
  const [sent] = fired;
  // The server dedups a replay on `input.idempotencyKey`; `operationId` is unused.
  expect(sent?.context.localFirst).toBe(true);
  expect(sent?.context.operationId).toBeUndefined();
  expect(sent?.variables).toEqual({
    today: todayKey(),
    batchesFirst: 100,
    input: {
      pantryItemId: 'item-1',
      idempotencyKey: expect.any(String),
      today: todayKey(),
    },
  });
  const { idempotencyKey } = sent?.variables.input as {
    idempotencyKey: string;
  };
  expect(idempotencyKey.length).toBeGreaterThan(0);
}

describe('useConvertExpiredToWaste — a stack with no batches', () => {
  it('writes quantity 0 + SPOILED before settle, sends the dated keyed input, and a queued (null) result keeps it', async () => {
    const cache = seedItem();
    const { result, fired, onSuccess } = renderConvert(cache, [
      convertMock(QUEUED),
    ]);

    let resolved: unknown = 'unset';
    await act(async () => {
      const promise = result.current.convertExpiredToWaste('item-1', {
        hasBatches: false,
      });
      // Synchronous permanent write — visible before the mutation settles.
      expect(readState(cache)).toMatchObject({
        quantity: 0,
        heldQuantity: 0,
        condition: ItemCondition.Spoiled,
      });
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    // Queued result keeps the optimistic state for replay.
    expect(readState(cache)).toMatchObject({
      quantity: 0,
      heldQuantity: 0,
      condition: ItemCondition.Spoiled,
    });
    expectConvertSent(fired);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ hasBatches: false });
  });

  it('reverts quantity + condition on a rejection (error-union result)', async () => {
    const cache = seedItem();
    const { result, onSuccess } = renderConvert(cache, [
      convertMock(NOT_FOUND),
    ]);

    let resolved: unknown = 'unset';
    await act(async () => {
      resolved = await result.current.convertExpiredToWaste('item-1', {
        hasBatches: false,
      });
    });

    expect(resolved).toBe(false);
    expect(readState(cache)).toMatchObject(SEEDED_STATE);
    expect(onSuccess).not.toHaveBeenCalled();
    // A refusal resolves as data; the hook still tells the user, in the copy
    // for a missing record rather than the server's text.
    expect(alertService.alert).toHaveBeenCalledWith(
      t('errors.notFoundTitle'),
      expect.stringContaining('could not be found'),
    );
  });
});

describe('useConvertExpiredToWaste — a stack held in batches', () => {
  it('writes nothing ahead of the answer, sends the dated keyed input, and a queued (null) result leaves the stack as it was', async () => {
    const refetchQueries = jest.spyOn(ApolloClient.prototype, 'refetchQueries');
    const cache = seedItem();
    const { result, fired, onSuccess } = renderConvert(cache, [
      convertMock(QUEUED),
    ]);

    let resolved: unknown = 'unset';
    await act(async () => {
      const promise = result.current.convertExpiredToWaste('item-1', {
        hasBatches: true,
      });
      // Which batches expired is the server's to say: no optimistic write.
      expect(readState(cache)).toMatchObject(SEEDED_STATE);
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    expect(readState(cache)).toMatchObject(SEEDED_STATE);
    expectConvertSent(fired);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ hasBatches: true });
    // Nothing to read yet: the resync after the queue drains re-reads them.
    expect(refetchQueries).not.toHaveBeenCalled();
    refetchQueries.mockRestore();
  });

  it('takes the stack the server recomputed when the convert applies', async () => {
    const refetchQueries = jest.spyOn(ApolloClient.prototype, 'refetchQueries');
    const cache = seedItem();
    const { result, onSuccess } = renderConvert(cache, [
      convertMock({
        convertExpiredToWaste: {
          __typename: 'ConvertExpiredToWastePayload',
          pantryItem: {
            __typename: 'PantryItem',
            id: 'item-1',
            quantity: 1,
            heldQuantity: 1,
            condition: ItemCondition.Good,
            activeBatchCount: 1,
          },
          batchesConnection: {
            totalCount: 1,
            pageInfo: { hasNextPage: false, endCursor: null },
            edges: [
              { node: { __typename: 'PantryItemBatch', id: 'batch-kept' } },
            ],
          },
        },
      }),
    ]);

    let resolved: unknown = 'unset';
    await act(async () => {
      resolved = await result.current.convertExpiredToWaste('item-1', {
        hasBatches: true,
      });
    });

    expect(resolved).toBe(true);
    // Only the expired batches left: the stack is not zeroed or spoiled.
    expect(readState(cache)).toMatchObject({
      quantity: 1,
      heldQuantity: 1,
      condition: ItemCondition.Good,
    });
    expect(onSuccess).toHaveBeenCalledWith({ hasBatches: true });
    // The answer restates the batches too: the wasted one leaves the detail's
    // list with its discard, and nothing is read again.
    const batches = cache.readQuery({
      optimistic: true,
      query: GetPantryItemBatchesDocument,
      variables: { pantryItemId: 'item-1' },
    })?.pantryItemBatchesConnection;
    expect(batches?.edges.map(edge => edge.node.id)).toEqual(['batch-kept']);
    expect(refetchQueries).not.toHaveBeenCalled();
    refetchQueries.mockRestore();
  });

  it('alerts, reports no success and leaves the stack alone on a rejection (error-union result)', async () => {
    const cache = seedItem();
    const { result, onSuccess } = renderConvert(cache, [
      convertMock(NOT_FOUND),
    ]);

    let resolved: unknown = 'unset';
    await act(async () => {
      resolved = await result.current.convertExpiredToWaste('item-1', {
        hasBatches: true,
      });
    });

    expect(resolved).toBe(false);
    expect(readState(cache)).toMatchObject(SEEDED_STATE);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(alertService.alert).toHaveBeenCalledWith(
      t('errors.notFoundTitle'),
      expect.stringContaining('could not be found'),
    );
  });
});
