import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  AddItemToShoppingListDocument,
  CreateShoppingListDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import type { DerivedList } from '#features/shoppingList/utils/listFromTemplate';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { useCopyShoppingList } from '../useCopyShoppingList';

const USER = {
  id: 'user-1',
  email: 'tani@example.com',
  emailVerified: true,
  onBoarded: true,
};

function derivedList(lines: number): DerivedList {
  const items = Array.from({ length: lines }, (_, i) => ({
    id: `line-${i}`,
    item: { inline: { id: `item-${i}`, name: `Item ${i}` } },
    quantity: '1',
  }));
  return {
    list: { name: 'Copy' },
    items,
    display: new Map(
      items.map(line => [
        line.id,
        { itemName: line.item.inline.name, itemId: line.item.inline.id },
      ]),
    ),
    skipped: [],
  };
}

const queuedCreate = () =>
  recordMock(CreateShoppingListDocument, {
    data: { createShoppingList: null },
  });

/** The rows shown once the writes answered have left their layers. */
const cachedRows = (cache: ReturnType<typeof seedCache>) => {
  pendingWritesOf(cache).rebuild();
  return Object.entries(cache.extract(true)).flatMap(([key, row]) =>
    key.startsWith('ShoppingListItem:') && row ? [key] : [],
  );
};

describe('useCopyShoppingList', () => {
  beforeEach(() => {
    useStore.setState({ user: USER, apiReachable: false, isOnline: false });
  });

  afterEach(() => {
    useStore.setState({ user: null, apiReachable: true, isOnline: true });
    jest.clearAllMocks();
  });

  // One create carries the list and its first 50 lines.
  it('sends the first 50 lines with the create and the rest in batches', async () => {
    const create = queuedCreate();
    const add = recordMock(AddItemToShoppingListDocument, {
      data: { addItemsToShoppingList: null },
    });
    const { result } = renderHookWithApollo(
      () => useCopyShoppingList('copy failed'),
      { cache: seedCache([]), operationMocks: [create.mock, add.mock] },
    );

    let copied: Awaited<ReturnType<typeof result.current.copyList>> = null;
    await act(async () => {
      copied = await result.current.copyList(derivedList(101));
    });

    const [sent] = create.fired as Array<{ input: { items: unknown[] } }>;
    expect(sent?.input.items).toHaveLength(50);
    const sizes = (add.fired as Array<{ input: { items: unknown[] } }>).map(
      fired => fired.input.items.length,
    );
    expect(sizes).toEqual([50, 1]);
    expect(copied).toEqual(expect.any(String));
  });

  it('withdraws the list and its lines when the create is refused', async () => {
    const refused = recordMock(CreateShoppingListDocument, {
      data: {
        createShoppingList: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'guest',
        },
      },
    });
    const cache = seedCache([]);
    const { result } = renderHookWithApollo(
      () => useCopyShoppingList('copy failed'),
      { cache, operationMocks: [refused.mock] },
    );

    let copied: Awaited<ReturnType<typeof result.current.copyList>> = null;
    await act(async () => {
      copied = await result.current.copyList(derivedList(3));
    });

    expect(copied).toBeNull();
    expect(
      Object.keys(cache.extract(true)).filter(key =>
        key.startsWith('ShoppingList:'),
      ),
    ).toEqual([]);
    expect(toastService.error).toHaveBeenCalledTimes(1);
  });

  it('takes back the rows of a refused batch and reports it', async () => {
    const refused = recordMock(AddItemToShoppingListDocument, {
      data: {
        addItemsToShoppingList: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'guest',
        },
      },
    });
    const cache = seedCache([]);
    const { result } = renderHookWithApollo(
      () => useCopyShoppingList('copy failed'),
      { cache, operationMocks: [queuedCreate().mock, refused.mock] },
    );

    let copied: Awaited<ReturnType<typeof result.current.copyList>> = null;
    await act(async () => {
      copied = await result.current.copyList(derivedList(53));
    });

    // The create's 50 stand; only the refused batch's 3 are taken back.
    expect(cachedRows(cache)).toHaveLength(50);
    expect(cachedRows(cache)).not.toContain('ShoppingListItem:line-50');
    expect(copied).toEqual(expect.any(String));
    expect(toastService.error).toHaveBeenCalledTimes(1);
  });

  it('takes back the one line the create refused and keeps the rest', async () => {
    const created = recordMock(CreateShoppingListDocument, {
      data: {
        createShoppingList: {
          __typename: 'CreateShoppingListPayload',
          shoppingList: { id: 'list-copy', name: 'Copy' },
          itemResults: [
            { index: 0, success: true, item: { id: 'line-0' } },
            { index: 1, success: false, item: null },
            { index: 2, success: true, item: { id: 'line-2' } },
          ],
        },
      },
    });
    const cache = seedCache([]);
    const { result } = renderHookWithApollo(
      () => useCopyShoppingList('copy failed'),
      { cache, operationMocks: [created.mock] },
    );

    await act(async () => {
      await result.current.copyList(derivedList(3));
    });

    expect(cachedRows(cache).sort()).toEqual([
      'ShoppingListItem:line-0',
      'ShoppingListItem:line-2',
    ]);
  });
});
