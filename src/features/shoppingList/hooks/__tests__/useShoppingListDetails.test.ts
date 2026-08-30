import { waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { GetShoppingListDetailsDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { useShoppingListDetails } from '../useShoppingListDetails';

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedQueryData: <T>(data: T | undefined, fallback: T): T =>
    data ?? fallback,
}));

interface BuildShoppingListArgs {
  id?: string;
  name?: string;
  isDefault?: boolean;
  collaborators?: Array<{ id: string; email: string }>;
}

function buildShoppingList(args: BuildShoppingListArgs = {}) {
  const id = args.id ?? 'list-1';
  const collaborators = args.collaborators ?? [];
  return {
    __typename: 'ShoppingList',
    id,
    name: args.name ?? 'Groceries',
    isDefault: args.isDefault ?? true,
    status: 'ACTIVE',
    isCompleted: false,
    completedShopDate: null,
    isRecurring: false,
    recurringPattern: null,
    recurringInterval: null,
    nextRecurringDate: null,
    isTemplate: false,
    templateName: null,
    basedOnTemplate: null,
    reminderEnabled: false,
    reminderDate: null,
    budgetAmount: null,
    totalCost: 0,
    estimatedTotal: 0,
    currency: null,
    priceTracking: false,
    totalItems: 0,
    completedItems: 0,
    homeId: 'home-1',
    shareCode: null,
    isPublic: false,
    home: {
      __typename: 'Home',
      id: 'home-1',
      name: 'Home',
      myMembership: {
        __typename: 'Membership',
        id: 'mem-1',
        role: MembershipRole.Member,
        canAddItems: true,
        canRemoveItems: true,
        canEditPantry: true,
      },
    },
    ownerships: [],
    collaboratorsConnection: {
      __typename: 'ShoppingListCollaboratorConnection',
      totalCount: collaborators.length,
      edges: collaborators.map(c => ({
        __typename: 'ShoppingListCollaboratorEdge',
        cursor: c.id,
        node: {
          __typename: 'ShoppingListCollaborator',
          id: c.id,
          email: c.email,
          role: 'EDITOR',
          status: 'ACTIVE',
          collaboratorId: c.id,
          canAddItems: true,
          canRemoveItems: true,
          canEditItems: true,
          canMarkPurchased: true,
          collaborator: {
            __typename: 'User',
            id: c.id,
            email: c.email,
            profile: {
              __typename: 'UserProfile',
              id: `profile-${c.id}`,
              displayName: c.email,
              avatar: null,
            },
          },
          invitedAt: '2025-01-01T00:00:00.000Z',
        },
      })),
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage: false,
        endCursor: null,
      },
    },
  };
}

function buildDetailsMock(
  listId: string,
  shoppingList: ReturnType<typeof buildShoppingList> | null,
): MockedResponse {
  return {
    request: {
      query: GetShoppingListDetailsDocument,
      variables: { id: listId },
    },
    result: {
      data: { shoppingList },
    },
    maxUsageCount: 10,
  };
}

function buildDetailsErrorMock(listId: string, error: Error): MockedResponse {
  return {
    request: {
      query: GetShoppingListDetailsDocument,
      variables: { id: listId },
    },
    error,
    maxUsageCount: 10,
  };
}

describe('useShoppingListDetails', () => {
  it('returns shopping list data', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListDetails('list-1'),
      {
        operationMocks: [
          buildDetailsMock(
            'list-1',
            buildShoppingList({
              id: 'list-1',
              name: 'Groceries',
              isDefault: true,
              collaborators: [{ id: 'collab-1', email: 'alice@test.com' }],
            }),
          ),
        ],
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shoppingList).not.toBeNull();
    expect(result.current.name).toBe('Groceries');
    expect(result.current.isDefault).toBe(true);
    expect(result.current.collaborators).toHaveLength(1);
    expect(result.current.collaborators[0].email).toBe('alice@test.com');
    expect(result.current.isShared).toBe(true);
  });

  it('returns default values when no shopping list data', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListDetails('list-1'),
      {
        operationMocks: [buildDetailsMock('list-1', null)],
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shoppingList).toBeNull();
    expect(result.current.name).toBe('');
    expect(result.current.isDefault).toBe(false);
    expect(result.current.collaborators).toEqual([]);
    expect(result.current.isShared).toBe(false);
  });

  it('returns no data on query error (errorPolicy: ignore)', async () => {
    const testError = new Error('Query failed');
    const { result } = renderHookWithApollo(
      () => useShoppingListDetails('list-1'),
      {
        operationMocks: [buildDetailsErrorMock('list-1', testError)],
      },
    );

    // Hook uses errorPolicy: 'ignore', so error is swallowed and shoppingList
    // falls back to null (default). Wait for the network cycle to complete.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shoppingList).toBeNull();
  });

  it('exposes refetch function', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListDetails('list-1'),
      {
        operationMocks: [buildDetailsMock('list-1', buildShoppingList())],
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
  });

  it('returns isShared false when no collaborators', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListDetails('list-1'),
      {
        operationMocks: [
          buildDetailsMock(
            'list-1',
            buildShoppingList({
              id: 'list-1',
              name: 'My List',
              isDefault: false,
              collaborators: [],
            }),
          ),
        ],
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isShared).toBe(false);
  });

  it('exposes isRefetching boolean from network status', async () => {
    const { result } = renderHookWithApollo(
      () => useShoppingListDetails('list-1'),
      {
        operationMocks: [buildDetailsMock('list-1', buildShoppingList())],
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.isRefetching).toBe('boolean');
    expect(result.current.isRefetching).toBe(false);
  });
});
