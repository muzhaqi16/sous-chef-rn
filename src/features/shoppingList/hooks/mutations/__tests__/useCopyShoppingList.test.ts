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
import { useCopyShoppingList } from '../useCopyShoppingList';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const USER = {
  id: 'user-1',
  email: 'tani@example.com',
  emailVerified: true,
  onBoarded: true,
};

function derivedList(lines: number): DerivedList {
  const items = Array.from({ length: lines }, (_, i) => ({
    id: `line-${i}`,
    item: { itemName: `Item ${i}` },
    quantity: '1',
  }));
  return {
    list: { name: 'Copy' },
    items,
    display: new Map(
      items.map(line => [line.id, { itemName: line.item.itemName }]),
    ),
    skipped: [],
  };
}

const queuedCreate = () =>
  recordMock(CreateShoppingListDocument, {
    data: { createShoppingList: null },
  });

const cachedRows = (cache: ReturnType<typeof seedCache>) =>
  Object.keys(cache.extract()).filter(key =>
    key.startsWith('ShoppingListItem:'),
  );

describe('useCopyShoppingList', () => {
  beforeEach(() => {
    useStore.setState({ user: USER, apiReachable: false, isOnline: false });
  });

  afterEach(() => {
    useStore.setState({ user: null, apiReachable: true, isOnline: true });
    jest.clearAllMocks();
  });

  it('sends the lines in batches the API accepts', async () => {
    const add = recordMock(AddItemToShoppingListDocument, {
      data: { addItemsToShoppingList: null },
    });
    const { result } = renderHookWithApollo(
      () => useCopyShoppingList('copy failed'),
      { cache: seedCache([]), operationMocks: [queuedCreate().mock, add.mock] },
    );

    let copied: Awaited<ReturnType<typeof result.current.copyList>> = null;
    await act(async () => {
      copied = await result.current.copyList(derivedList(51));
    });

    const sizes = (add.fired as Array<{ input: { items: unknown[] } }>).map(
      fired => fired.input.items.length,
    );
    expect(sizes).toEqual([50, 1]);
    expect(copied).toEqual(expect.any(String));
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
      copied = await result.current.copyList(derivedList(3));
    });

    expect(cachedRows(cache)).toEqual([]);
    // The list stands; only its refused lines are taken back.
    expect(copied).toEqual(expect.any(String));
    expect(toastService.error).toHaveBeenCalledTimes(1);
  });
});
