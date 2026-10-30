import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { StoreDepartment } from '#/graphql/generated/schemaTypes';
import {
  UseMoveToAisleModal_ItemFragmentDoc,
  type UseMoveToAisleModal_ItemFragment,
} from '../useMoveToAisleModal.generated';
import { useMoveToAisleModal } from '../useMoveToAisleModal';

const LINE: UseMoveToAisleModal_ItemFragment = {
  __typename: 'ShoppingListItem',
  id: 'line-1',
  version: 4,
  storeDepartment: StoreDepartment.Other,
  storeDepartmentOverride: null,
  item: {
    __typename: 'Item',
    version: 1,
    id: 'item-1',
    storeDepartment: StoreDepartment.Other,
  },
};

/** Seeds the line, mounts the hook and opens the sheet on the line. */
function setup(
  answer: MockDataFor<typeof UpdateShoppingListItemDocument>,
  line: Partial<UseMoveToAisleModal_ItemFragment> = {},
) {
  const cache = seedCache([
    {
      fragment: UseMoveToAisleModal_ItemFragmentDoc,
      data: { ...LINE, ...line },
    },
  ]);
  const update = recordMock(UpdateShoppingListItemDocument, { data: answer });
  const { result } = renderHookWithApollo(() => useMoveToAisleModal(), {
    cache,
    operationMocks: [update.mock],
  });
  act(() => result.current.openForItem('line-1'));
  const moveTo = (department: StoreDepartment | null) =>
    act(() => result.current.moveTo(department));
  const readLine = () =>
    cache.readFragment({
      id: cache.identify({
        __typename: 'ShoppingListItem',
        version: 1,
        id: 'line-1',
      }),
      fragment: UseMoveToAisleModal_ItemFragmentDoc,
      fragmentName: 'useMoveToAisleModal_item',
    });
  const readPersisted = () => {
    optimisticDataPersistence.flush();
    return optimisticDataPersistence.get('ShoppingListItem', 'line-1');
  };
  return { result, update, moveTo, readLine, readPersisted };
}

const queued: MockDataFor<typeof UpdateShoppingListItemDocument> = {
  updateShoppingListItem: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  optimisticDataPersistence.clearAll();
});

describe('useMoveToAisleModal', () => {
  it('opens on the aisle a line is in', () => {
    const { result } = setup(queued);

    expect(result.current.visible).toBe(true);
    expect(result.current.line).toEqual({
      department: StoreDepartment.Other,
      moved: false,
    });
  });

  // Queued offline, the line must stay in its new aisle through a restart.
  it('moves the line at once, and sends its own aisle on the line update', async () => {
    const { result, update, moveTo, readLine, readPersisted } = setup(queued);

    await moveTo(StoreDepartment.Frozen);

    expect(result.current.visible).toBe(false);
    expect(readLine()).toMatchObject({
      storeDepartment: StoreDepartment.Frozen,
      storeDepartmentOverride: StoreDepartment.Frozen,
    });
    expect(readPersisted()).toEqual({
      storeDepartment: StoreDepartment.Frozen,
      storeDepartmentOverride: StoreDepartment.Frozen,
    });
    expect(update.fired).toEqual([
      {
        input: {
          id: 'line-1',
          version: 4,
          storePrefs: { storeDepartmentOverride: StoreDepartment.Frozen },
        },
      },
    ]);
  });

  it("puts a moved line back under its item's aisle", async () => {
    const { result, update, moveTo, readLine } = setup(queued, {
      storeDepartment: StoreDepartment.Frozen,
      storeDepartmentOverride: StoreDepartment.Frozen,
      item: {
        __typename: 'Item',
        version: 1,
        id: 'item-1',
        storeDepartment: StoreDepartment.DairyEggs,
      },
    });
    expect(result.current.line?.moved).toBe(true);

    await moveTo(null);

    expect(readLine()).toMatchObject({
      storeDepartment: StoreDepartment.DairyEggs,
      storeDepartmentOverride: null,
    });
    expect(update.fired).toEqual([
      {
        input: {
          id: 'line-1',
          version: 4,
          storePrefs: { storeDepartmentOverride: null },
        },
      },
    ]);
  });

  it('returns the line to its aisle when the server refuses the move', async () => {
    const { moveTo, readLine, readPersisted } = setup({
      updateShoppingListItem: { __typename: 'ValidationError' },
    });

    await moveTo(StoreDepartment.Frozen);

    expect(readLine()).toMatchObject({
      storeDepartment: StoreDepartment.Other,
      storeDepartmentOverride: null,
    });
    // Both fields it kept for a restart are let go.
    expect(readPersisted()).toEqual({});
  });
});
