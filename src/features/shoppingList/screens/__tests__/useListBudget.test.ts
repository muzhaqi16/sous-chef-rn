import { act, waitFor } from '@testing-library/react-native';
import type { Unmasked } from '@apollo/client/masking';
import {
  completeMockedResponse,
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  CollaboratorRole,
  CollaboratorStatus,
  MembershipRole,
  PriceComparisonScope,
} from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import { useListBudget } from '../useListBudget';
import {
  ListBudgetDocument,
  type ListBudgetQuery,
} from '../useListBudget.generated';

const OWNER = {
  id: 'user-1',
  email: 'owner@example.com',
  emailVerified: true,
  onBoarded: true,
};

// Every field the screen and its writes read, so the read is answered here.
const LIST = {
  __typename: 'ShoppingList',
  id: 'list-1',
  name: 'Groceries',
  isDefault: false,
  status: 'ACTIVE',
  isCompleted: false,
  completedShopDate: null,
  budgetAmount: 60,
  currency: 'USD',
  totalCost: 18.4,
  estimatedTotal: 42.1,
  unpricedItems: 3,
  priceTracking: true,
  targetStore: null,
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
  ownerships: [
    { __typename: 'ShoppingListOwnership', id: 'own-1', userId: 'user-1' },
  ],
  homeId: null,
  home: null,
  collaboratorsConnection: { edges: [] },
};

type ListSeed = Partial<
  Omit<typeof LIST, 'homeId' | 'home' | 'collaboratorsConnection'>
> &
  Record<string, unknown>;

/** The list as the screen's read left it on the device. */
function cacheWith(list: ListSeed = {}) {
  const cache = seedCache([]);
  const variables = { id: 'list-1' };
  const completed = completeMockedResponse({
    request: { query: ListBudgetDocument, variables },
    result: { data: { shoppingList: { ...LIST, ...list } } },
  }).result as (vars: typeof variables) => {
    data: Unmasked<ListBudgetQuery>;
  };
  cache.writeQuery({
    query: ListBudgetDocument,
    variables,
    data: completed(variables).data,
  });
  return cache;
}

const render = (
  operationMocks: Parameters<typeof renderHookWithApollo>[1],
  list?: ListSeed,
) =>
  renderHookWithApollo(() => useListBudget('list-1'), {
    cache: cacheWith(list),
    ...operationMocks,
  });

const collaborator = (canEdit: boolean) => ({
  collaboratorsConnection: {
    edges: [
      {
        node: {
          __typename: 'ShoppingListCollaborator',
          id: 'collab-1',
          collaboratorId: 'user-2',
          collaborator: { __typename: 'User', id: 'user-2' },
          status: CollaboratorStatus.Active,
          role: canEdit ? CollaboratorRole.Editor : CollaboratorRole.Viewer,
          canEdit,
        },
      },
    ],
  },
});

describe('useListBudget', () => {
  beforeEach(() => {
    useStore.setState({ user: OWNER, isOnline: false, apiReachable: false });
  });

  afterEach(() => {
    useStore.setState({ user: null, isOnline: true, apiReachable: true });
  });

  it('reads the list from the device, offline', () => {
    const { result } = render({ operationMocks: [] });

    expect(result.current.list).toMatchObject({
      budgetAmount: 60,
      totalCost: 18.4,
      estimatedTotal: 42.1,
      unpricedItems: 3,
    });
    expect(result.current.state).toBe('ready');
  });

  it("offers its controls to the list's owner", () => {
    expect(render({ operationMocks: [] }).result.current.canEdit).toBe(true);
  });

  // The API gates the budget, store and tracking on EDIT, not on ownership.
  it("offers them to a home's member on a list another member made", () => {
    useStore.setState({ user: { ...OWNER, id: 'user-2' } });
    const { result } = render(
      { operationMocks: [] },
      {
        homeId: 'home-1',
        home: {
          __typename: 'Home',
          id: 'home-1',
          myMembership: {
            __typename: 'Membership',
            id: 'm-2',
            role: MembershipRole.Member,
          },
        },
      },
    );

    expect(result.current.canEdit).toBe(true);
  });

  it('offers them to a collaborator who may edit, and not to one who may only view', () => {
    useStore.setState({ user: { ...OWNER, id: 'user-2' } });

    expect(
      render({ operationMocks: [] }, collaborator(true)).result.current.canEdit,
    ).toBe(true);
    expect(
      render({ operationMocks: [] }, collaborator(false)).result.current
        .canEdit,
    ).toBe(false);
  });

  it('offers nothing before the list is on the device', () => {
    const { result } = renderHookWithApollo(() => useListBudget('list-1'), {
      cache: seedCache([]),
      operationMocks: [],
    });

    expect(result.current.list).toBeNull();
    expect(result.current.canEdit).toBe(false);
  });

  it('reports a budget that is not a number, and sends nothing', () => {
    const update = recordMock(UpdateShoppingListDocument, {
      data: { updateShoppingList: null },
    });
    const { result } = render({ operationMocks: [update.mock] });

    expect(result.current.saveBudget('abc')).toBe('invalid');
    expect(result.current.saveBudget('60')).toBe('unchanged');
    expect(update.fired).toHaveLength(0);
  });

  it('saves a changed limit, and an empty field clears it', async () => {
    const update = recordMock(UpdateShoppingListDocument, {
      data: { updateShoppingList: null },
    });
    const { result } = render({ operationMocks: [update.mock] });

    act(() => {
      expect(result.current.saveBudget('75')).toBe('saved');
    });
    await waitFor(() =>
      expect(update.fired[0]).toMatchObject({
        input: {
          id: 'list-1',
          planning: { budgetAmount: 75, currency: 'USD' },
        },
      }),
    );
    // Written before the answer, so it shows at once and offline.
    expect(result.current.list?.budgetAmount).toBe(75);

    act(() => {
      expect(result.current.saveBudget('')).toBe('saved');
    });
    await waitFor(() =>
      expect(update.fired[1]).toMatchObject({
        input: { planning: { budgetAmount: null } },
      }),
    );
    expect(result.current.list?.budgetAmount).toBeNull();
  });

  it('turns price tracking off at once, offline', async () => {
    const update = recordMock(UpdateShoppingListDocument, {
      data: { updateShoppingList: null },
    });
    const { result } = render({ operationMocks: [update.mock] });

    act(() => {
      result.current.setPriceTracking(false);
    });

    await waitFor(() =>
      expect(update.fired[0]).toMatchObject({
        input: { id: 'list-1', settings: { priceTracking: false } },
      }),
    );
    expect(result.current.list?.priceTracking).toBe(false);
  });

  it('sends a picked store with the comparison on screen', async () => {
    const update = recordMock(UpdateShoppingListDocument, {
      data: { updateShoppingList: null },
    });
    const { result } = render({ operationMocks: [update.mock] });

    act(() => {
      result.current.pickStore({ id: 'store-1', name: 'Giant Eagle' });
    });

    await waitFor(() =>
      expect(update.fired[0]).toMatchObject({
        input: { planning: { targetStoreId: 'store-1' } },
        withComparison: true,
        comparisonScope: PriceComparisonScope.Store,
      }),
    );
    expect(result.current.list?.targetStore?.name).toBe('Giant Eagle');
  });
});
