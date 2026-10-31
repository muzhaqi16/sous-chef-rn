import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { GetShoppingListItemsFilteredDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useOpenListLinesFor } from '../useOpenListLinesFor';

const lookup = () =>
  recordMock(GetShoppingListItemsFilteredDocument, {
    dataFor: (
      vars,
    ): MockDataFor<typeof GetShoppingListItemsFilteredDocument> => ({
      shoppingList: {
        id: String(vars.id),
        itemsConnection: {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    }),
  });

const itemsOf = (count: number) =>
  Array.from(
    { length: count },
    (_, at) => `item-${String(at).padStart(3, '0')}`,
  );

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useOpenListLinesFor', () => {
  it('asks for every item of a receipt, each once', async () => {
    const asked = lookup();
    const { result } = renderHookWithApollo(
      () => useOpenListLinesFor('list-1', ['item-b', 'item-a', 'item-b']),
      { operationMocks: [asked.mock] },
    );

    await drainTimers();
    expect(asked.fired).toHaveLength(1);
    expect(asked.fired[0]?.itemIds).toEqual(['item-a', 'item-b']);
    await drainTimers();
    expect(result.current.loading).toBe(false);
    expect(result.current.incomplete).toBe(false);
  });

  it('asks for at most the 100 items the API takes, and says the rest went unread', async () => {
    const asked = lookup();
    const { result } = renderHookWithApollo(
      () => useOpenListLinesFor('list-1', itemsOf(101)),
      { operationMocks: [asked.mock] },
    );

    await drainTimers();
    expect(asked.fired).toHaveLength(1);
    expect(asked.fired[0]?.itemIds).toHaveLength(100);
    expect(result.current.incomplete).toBe(true);
  });

  // A receipt's lines bring five candidates each: past the limit they give
  // way, never the items the lines are, whichever sorts first.
  it('asks for the spare items only while the limit has room', async () => {
    const asked = lookup();
    const needed = itemsOf(98).map(id => `z-${id}`);
    const { result } = renderHookWithApollo(
      () => useOpenListLinesFor('list-1', needed, itemsOf(50)),
      { operationMocks: [asked.mock] },
    );

    await drainTimers();
    expect(asked.fired).toHaveLength(1);
    expect(asked.fired[0]?.itemIds).toHaveLength(100);
    expect(asked.fired[0]?.itemIds).toEqual(expect.arrayContaining(needed));
    await drainTimers();
    expect(result.current.loading).toBe(false);
    expect(result.current.incomplete).toBe(false);
  });
});
