// __tests__/shoppingListSlice.test.ts
import type {ShoppingList} from '../src/types';
import {create} from 'zustand';
import {UseBoundStore, StoreApi} from 'zustand';
import {
  createShoppingListSlice,
  ShoppingListState,
} from '../src/store/shoppingListSlice';
import {
  fetchShoppingListsApi,
  createShoppingListApi,
  shareShoppingListApi,
} from '../src/api/services/shoppingListService';

// Mock the service module exactly as imported above:
jest.mock('../src/api/services/shoppingListService', () => ({
  fetchShoppingListsApi: jest.fn(),
  createShoppingListApi: jest.fn(),
  shareShoppingListApi: jest.fn(),
}));

describe('shoppingListSlice', () => {
  // Let TS infer the store type, or optionally:
  // let useTestStore: ReturnType<typeof create<ShoppingListState>>;
  let useTestStore: UseBoundStore<StoreApi<ShoppingListState>>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Use zustand's typical store factory signature:
    useTestStore = create<ShoppingListState>(createShoppingListSlice);
  });

  it('initial state is empty', () => {
    const state = useTestStore.getState();
    expect(state.shoppingLists).toEqual([]);
    expect(state.defaultShoppingList).toBeNull();
  });

  it('fetchShoppingLists sets shoppingLists and defaultShoppingList', async () => {
    const mockLists: ShoppingList[] = [
      {id: '1', name: 'List 1'} as ShoppingList,
      {id: '2', name: 'List 2'} as ShoppingList,
    ];
    (fetchShoppingListsApi as jest.Mock).mockResolvedValue(mockLists);

    await useTestStore.getState().fetchShoppingLists();

    const state = useTestStore.getState();
    expect(fetchShoppingListsApi).toHaveBeenCalledTimes(1);
    expect(state.shoppingLists).toEqual(mockLists);
    expect(state.defaultShoppingList).toEqual(mockLists[0]);
  });

  it('fetchShoppingLists retains existing default if already set', async () => {
    const existing: ShoppingList = {id: 'x', name: 'Existing'} as ShoppingList;
    useTestStore.setState({
      shoppingLists: [existing],
      defaultShoppingList: existing,
    });

    const mockLists: ShoppingList[] = [
      {id: '1', name: 'List 1'} as ShoppingList,
      {id: '2', name: 'List 2'} as ShoppingList,
    ];
    (fetchShoppingListsApi as jest.Mock).mockResolvedValue(mockLists);

    await useTestStore.getState().fetchShoppingLists();

    const state = useTestStore.getState();
    expect(state.shoppingLists).toEqual(mockLists);
    expect(state.defaultShoppingList).toEqual(existing);
  });

  it('createShoppingList appends and sets default if none', async () => {
    const newList: ShoppingList = {id: 'new', name: 'New List'} as ShoppingList;
    (createShoppingListApi as jest.Mock).mockResolvedValue(newList);

    expect(useTestStore.getState().defaultShoppingList).toBeNull();

    await useTestStore.getState().createShoppingList('New List');

    const state = useTestStore.getState();
    expect(createShoppingListApi).toHaveBeenCalledWith('New List');
    expect(state.shoppingLists).toContainEqual(newList);
    expect(state.defaultShoppingList).toEqual(newList);
  });

  it('createShoppingList appends without changing default if one already exists', async () => {
    const existing: ShoppingList = {
      id: 'exist',
      name: 'Existing',
    } as ShoppingList;
    useTestStore.setState({
      shoppingLists: [existing],
      defaultShoppingList: existing,
    });

    const newList: ShoppingList = {id: 'new', name: 'New List'} as ShoppingList;
    (createShoppingListApi as jest.Mock).mockResolvedValue(newList);

    await useTestStore.getState().createShoppingList('New List');

    const state = useTestStore.getState();
    expect(state.shoppingLists).toEqual([existing, newList]);
    expect(state.defaultShoppingList).toEqual(existing);
  });

  it('shareShoppingList calls service', async () => {
    (shareShoppingListApi as jest.Mock).mockResolvedValue(undefined);

    await useTestStore.getState().shareShoppingList('1', 'foo@example.com');

    expect(shareShoppingListApi).toHaveBeenCalledWith('1', 'foo@example.com');
  });

  it('setDefaultShoppingList updates defaultShoppingList', () => {
    const list: ShoppingList = {id: 'abc', name: 'List ABC'} as ShoppingList;
    useTestStore.getState().setDefaultShoppingList(list);

    expect(useTestStore.getState().defaultShoppingList).toEqual(list);
  });

  it('fetchShoppingLists logs error on failure', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    (fetchShoppingListsApi as jest.Mock).mockRejectedValue(
      new Error('Network down'),
    );

    await expect(
      useTestStore.getState().fetchShoppingLists(),
    ).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching shopping lists:',
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });

  it('createShoppingList logs error on failure', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    (createShoppingListApi as jest.Mock).mockRejectedValue(
      new Error('Creation failed'),
    );

    await expect(
      useTestStore.getState().createShoppingList('Name'),
    ).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error creating shopping list:',
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });
});
