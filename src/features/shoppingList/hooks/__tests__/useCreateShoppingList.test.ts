import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { createLocalShoppingListItem } from '#features/shoppingList/cache/items';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useUser } from '#store/useAppStore';
import { useCreateShoppingList } from '../useCreateShoppingList';
import type { CreateShoppingListOutcome } from '../useCreateShoppingList';

// The hook only reads the auth identity through this selector.
jest.mock('#store/useAppStore', () => ({
  useUser: jest.fn(),
}));

const mockUser = {
  id: 'user-1',
  email: 'tani@example.com',
  emailVerified: true,
  onBoarded: true,
};

/**
 * Drives the real `CreateShoppingList` operation. `variables` always matches,
 * as the hook mints the row's cuid id itself, and records what was sent.
 */
const createMock = (
  outcome: { result?: MockedResponse['result']; error?: Error },
  sent: unknown[] = [],
): MockFor<typeof CreateShoppingListDocument> => ({
  request: {
    query: CreateShoppingListDocument,
    variables: vars => {
      sent.push(vars);
      return true;
    },
  },
  ...outcome,
});

const answered = (id: string, name: string) => ({
  data: {
    createShoppingList: {
      __typename: 'CreateShoppingListPayload',
      shoppingList: { __typename: 'ShoppingList', id, name },
    },
  },
});

/** What `queueLink` emits for a queued mutation: the field present but null. */
const queued = { data: { createShoppingList: null } };

const refused = {
  data: {
    createShoppingList: {
      __typename: 'ValidationError',
      code: 'VALIDATION_FAILED',
      message: 'Name is required',
      field: 'name',
    },
  },
};

const FALLBACK = 'Failed to create list';
const CUID = /^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/;

const lines = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `line-${index}`,
    item: { inline: { name: `Item ${index}` } },
  }));

const create = async (
  operationMocks: MockedResponse[],
  { name = 'Weekly', lineCount = 0 } = {},
) => {
  const cache = makeCache();
  const { result } = renderHookWithApollo(
    () => useCreateShoppingList(FALLBACK),
    { cache, operationMocks },
  );
  const items = lines(lineCount);
  let outcome: CreateShoppingListOutcome<(typeof items)[number]> | undefined;
  await act(async () => {
    outcome = await result.current.createShoppingList(
      { name },
      {
        items,
        rowOf: (line, listId) =>
          createLocalShoppingListItem(line.id, {
            shoppingListId: listId,
            itemName: line.item.inline.name,
          }),
      },
    );
  });
  return { cache, outcome };
};

const shownKeys = (cache: ReturnType<typeof makeCache>, prefix: string) =>
  Object.entries(cache.extract(true)).flatMap(([key, row]) =>
    key.startsWith(prefix) && row ? [key] : [],
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useUser).mockReturnValue(mockUser);
});

describe('useCreateShoppingList', () => {
  it('sends a minted id and returns the server’s list', async () => {
    const sent: { input?: { id?: string; name?: string } }[] = [];

    const { outcome } = await create([
      createMock({ result: answered('srv-echo', 'Weekly') }, sent),
    ]);

    // Matches the server id validator (cuid2 or legacy cuid v1 / 24-char hex).
    expect(sent[0]?.input?.id).toMatch(CUID);
    expect(sent[0]?.input?.name).toBe('Weekly');
    expect(outcome).toMatchObject({
      status: 'created',
      shoppingList: { id: 'srv-echo', name: 'Weekly' },
    });
  });

  it('holds a queued list under its minted id, outside the server’s data', async () => {
    const { cache, outcome } = await create([createMock({ result: queued })]);

    expect(outcome?.status).toBe('created');
    expect(outcome?.status === 'created' && outcome.shoppingList.id).toMatch(
      CUID,
    );
    expect(outcome).toMatchObject({ shoppingList: { name: 'Weekly' } });
    expect(shownKeys(cache, 'ShoppingList:')).toHaveLength(1);
    expect(Object.keys(cache.extract())).not.toEqual(
      expect.arrayContaining(shownKeys(cache, 'ShoppingList:')),
    );
  });

  it('leaves nothing of a refused list, and reports it in the caller’s copy', async () => {
    const { cache, outcome } = await create([createMock({ result: refused })]);

    expect(outcome).toEqual({ status: 'failed', body: FALLBACK });
    expect(shownKeys(cache, 'ShoppingList:')).toEqual([]);
  });

  it('leaves nothing when the request never reaches the server', async () => {
    // Under `errorPolicy: 'all'` a transport failure RESOLVES with `error` set
    // and no payload — that is what the app actually sees.
    const { cache, outcome } = await create([
      createMock({ error: new Error('network down') }),
    ]);

    expect(outcome).toEqual({ status: 'failed', body: FALLBACK });
    expect(shownKeys(cache, 'ShoppingList:')).toEqual([]);
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

    const { outcome } = await create([createMock({ error: rateLimited })]);

    expect(outcome).toEqual({
      status: 'failed',
      body: 'Too many requests. Please try again in 10 minutes.',
    });
  });

  it('shows nothing ahead of the answer with no auth identity', async () => {
    jest.mocked(useUser).mockReturnValue(null);

    const { cache, outcome } = await create([createMock({ result: queued })]);

    expect(shownKeys(cache, 'ShoppingList:')).toEqual([]);
    expect(outcome).toEqual({ status: 'failed', body: FALLBACK });
  });

  describe('made with starting lines', () => {
    it('holds the lines one create carries, and leaves the rest to send', async () => {
      const sent: { input?: { items?: unknown[] } }[] = [];

      const { cache, outcome } = await create(
        [createMock({ result: queued }, sent)],
        { lineCount: 60 },
      );

      expect(shownKeys(cache, 'ShoppingListItem:')).toHaveLength(50);
      expect(sent[0]?.input?.items).toHaveLength(50);
      expect(outcome?.status === 'created' && outcome.unsent).toHaveLength(10);
    });

    it('takes its lines back with a refused create', async () => {
      const { cache, outcome } = await create(
        [createMock({ result: refused })],
        { lineCount: 60 },
      );

      expect(outcome?.status).toBe('failed');
      expect(shownKeys(cache, 'ShoppingListItem:')).toEqual([]);
    });
  });
});
