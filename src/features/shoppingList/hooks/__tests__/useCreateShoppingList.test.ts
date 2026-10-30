import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { errorService } from '#/services/errorService';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import {
  renderHookWithApollo,
  type MockedResponse,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useCreateShoppingList } from '../useCreateShoppingList';
import {
  revertOptimisticShoppingList,
  writeLocalShoppingList,
} from '#features/shoppingList/cache/list';
import { useUser } from '#store/useAppStore';
import type { CreateShoppingListOutcome } from '../useCreateShoppingList';

// The hook only reads the auth identity through this selector.
jest.mock('#store/useAppStore', () => ({
  useUser: jest.fn(),
}));

jest.mock('#features/shoppingList/cache/list', () => ({
  addShoppingListToQueryCache: jest.fn(),
  writeLocalShoppingList: jest.fn(),
  revertOptimisticShoppingList: jest.fn(),
}));

const mockUser = {
  id: 'user-1',
  email: 'tani@example.com',
  emailVerified: true,
  onBoarded: true,
};

/**
 * Drives the real `CreateShoppingList` operation. `variables: () => true`
 * because the hook mints the row's cuid id itself, so the test cannot predict
 * the input it will send.
 */
const createMock = (outcome: {
  result?: MockedResponse['result'];
  error?: Error;
}): MockFor<typeof CreateShoppingListDocument> => ({
  request: { query: CreateShoppingListDocument, variables: () => true },
  ...outcome,
});

const successResult = (id: string, name: string) => ({
  data: {
    createShoppingList: {
      __typename: 'CreateShoppingListPayload',
      shoppingList: { __typename: 'ShoppingList', id, name },
    },
  },
});

const FALLBACK = 'Failed to create list';
const CUID = /^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/;

const create = async (
  operationMocks: MockedResponse[],
  name: string,
): Promise<CreateShoppingListOutcome | undefined> => {
  const { result } = renderHookWithApollo(
    () => useCreateShoppingList(FALLBACK),
    { operationMocks },
  );
  let outcome: CreateShoppingListOutcome | undefined;
  await act(async () => {
    outcome = await result.current.createShoppingList({ name });
  });
  return outcome;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useUser).mockReturnValue(mockUser);
});

describe('useCreateShoppingList', () => {
  it('writes the list PERMANENTLY with a client-minted cuid id BEFORE firing the mutation (local-first)', async () => {
    const outcome = await create(
      [createMock({ result: successResult('srv-echo', 'Weekly') })],
      'Weekly',
    );

    // The local list was written with a real cuid2 id (the row's PK) from the
    // create input and the auth identity, before the mutation fired.
    expect(writeLocalShoppingList).toHaveBeenCalledTimes(1);
    const [, mintedId, input, owner] = jest.mocked(writeLocalShoppingList).mock
      .calls[0]!;
    // Matches the server id validator (cuid2 or legacy cuid v1 / 24-char hex).
    expect(mintedId).toMatch(CUID);
    expect(input).toEqual({ name: 'Weekly' });
    expect(owner).toEqual(mockUser);
    // Online success returns the server entity. The rest of the selection set
    // is filled from the SDL, so this pins the identity the assertion is about
    // rather than the exhaustive shape.
    expect(outcome).toMatchObject({
      status: 'created',
      shoppingList: {
        __typename: 'ShoppingList',
        id: 'srv-echo',
        name: 'Weekly',
      },
    });
    expect(revertOptimisticShoppingList).not.toHaveBeenCalled();
  });

  it('treats a queued create (offline / API down) as created and returns the optimistic list', async () => {
    // What `queueLink` emits for a queued mutation: the field present but null.
    const outcome = await create(
      [createMock({ result: { data: { createShoppingList: null } } })],
      'Offline',
    );

    expect(outcome?.status).toBe('created');
    expect(outcome?.status === 'created' && outcome.shoppingList.id).toMatch(
      CUID,
    );
    expect(outcome).toMatchObject({ shoppingList: { name: 'Offline' } });
    expect(revertOptimisticShoppingList).not.toHaveBeenCalled();
  });

  it('reverts the optimistic list and reports a refusal in the caller’s copy', async () => {
    const outcome = await create(
      [
        createMock({
          result: {
            data: {
              createShoppingList: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'Name is required',
                field: 'name',
              },
            },
          },
        }),
      ],
      '',
    );

    expect(outcome).toEqual({ status: 'failed', body: FALLBACK });
    expect(revertOptimisticShoppingList).toHaveBeenCalledTimes(1);
  });

  it('reverts the optimistic list when the request never reaches the server', async () => {
    // Under `errorPolicy: 'all'` a transport failure RESOLVES with `error` set
    // and no payload — that is what the app actually sees.
    const outcome = await create(
      [createMock({ error: new Error('network down') })],
      'Weekly',
    );

    expect(outcome).toEqual({ status: 'failed', body: FALLBACK });
    expect(revertOptimisticShoppingList).toHaveBeenCalledTimes(1);
  });

  it('reports a coded resolved error in its code’s copy, not the generic failure', async () => {
    const rateLimited = Object.assign(new Error('rate limited'), {
      errors: [
        {
          message: 'Too many requests',
          extensions: { code: 'OPERATION_RATE_LIMITED', retryAfter: 600 },
        },
      ],
    });

    const outcome = await create(
      [createMock({ error: rateLimited })],
      'Weekly',
    );

    expect(outcome).toEqual({
      status: 'failed',
      body: 'Too many requests. Please try again in 10 minutes.',
    });
    expect(revertOptimisticShoppingList).toHaveBeenCalledTimes(1);
  });

  it('falls back to online-only behavior when no auth identity is available', async () => {
    jest.mocked(useUser).mockReturnValue(null);

    const outcome = await create(
      [createMock({ result: successResult('srv-1', 'Weekly') })],
      'Weekly',
    );

    expect(writeLocalShoppingList).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      status: 'created',
      shoppingList: { id: 'srv-1' },
    });
  });

  // A copy or a generated list: its lines are cached before the create fires.
  describe('made with starting lines', () => {
    const LINE = gql`
      fragment _StartingLineProbe on ShoppingListItem {
        id
        itemName
      }
    `;
    const lines = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `line-${index}`,
        item: { inline: { name: `Item ${index}` } },
      }));
    const lineKeys = (cache: ReturnType<typeof makeCache>) =>
      Object.keys(cache.extract()).filter(key =>
        key.startsWith('ShoppingListItem:'),
      );

    const createWithLines = async (
      operationMocks: MockedResponse[],
      count: number,
      write?: (cache: ReturnType<typeof makeCache>) => () => void,
    ) => {
      const cache = makeCache();
      const items = lines(count);
      const writeLines = (listId: string) => {
        for (const line of items) {
          seedFragment(cache, {
            fragment: LINE,
            data: {
              __typename: 'ShoppingListItem',
              id: line.id,
              itemName: `${listId} ${line.id}`,
            },
          });
        }
      };
      const { result } = renderHookWithApollo(
        () => useCreateShoppingList(FALLBACK),
        { cache, operationMocks },
      );
      let outcome:
        | CreateShoppingListOutcome<(typeof items)[number]>
        | undefined;
      await act(async () => {
        outcome = await result.current.createShoppingList(
          { name: 'Copy' },
          { items, write: write ? write(cache) : writeLines },
        );
      });
      return { cache, outcome };
    };

    it('still sends the create when its lines cannot be cached', async () => {
      const report = jest.spyOn(errorService, 'reportError');
      const fired: unknown[] = [];
      const { outcome } = await createWithLines(
        [
          {
            request: {
              query: CreateShoppingListDocument,
              variables: vars => {
                fired.push(vars);
                return true;
              },
            },
            result: successResult('list-1', 'Copy'),
          },
        ],
        2,
        () => () => {
          throw new Error('cache write failed');
        },
      );

      expect(fired).toHaveLength(1);
      expect(outcome).toMatchObject({ status: 'created' });
      expect(report).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          operation: 'Create Shopping List lines (optimistic)',
        }),
      );
    });

    it('takes every starting line back with a refused create, the unsent too', async () => {
      const { cache, outcome } = await createWithLines(
        [
          createMock({
            result: {
              data: {
                createShoppingList: {
                  __typename: 'ConflictError',
                  code: 'CONFLICT',
                  message: 'taken',
                },
              },
            },
          }),
        ],
        60,
      );

      expect(outcome).toMatchObject({ status: 'failed' });
      expect(revertOptimisticShoppingList).toHaveBeenCalledTimes(1);
      expect(lineKeys(cache)).toEqual([]);
    });
  });
});
