// "Not yet known" must not read as "allowed".
//
// The detail query is undefined for the first frames and STAYS undefined when it
// errors or the list is served from a cache that never held the permission data
// — so a default of all-allowed hands a viewer the add bar, swipe-to-delete and
// reorder, and offline those writes are queued and refused later.

import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CollaboratorRole,
  CollaboratorStatus,
} from '#/graphql/generated/schemaTypes';
import {
  ShoppingListCollaboratorFragmentDoc,
  type ShoppingListCollaboratorFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { useShoppingListPermissions } from '#features/shoppingList/hooks/useShoppingListPermissions';

const renderPermissions = (
  listDetails: Parameters<typeof useShoppingListPermissions>[0],
  userId?: string,
) =>
  renderHookWithApollo(() => useShoppingListPermissions(listDetails, userId), {
    operationMocks: [],
  });

describe('useShoppingListPermissions', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('offers nothing while the answer is %s', (_label, listDetails) => {
    const { result } = renderPermissions(listDetails);

    expect(result.current).toEqual({
      canAddItems: false,
      canRemoveItems: false,
      canEditItems: false,
      canMarkPurchased: false,
      resolved: false,
    });
  });

  it('reports the answer as unresolved so a caller can wait rather than refuse', () => {
    const { result } = renderPermissions(undefined);

    expect(result.current.resolved).toBe(false);
  });

  it('resolves once the list details are there', () => {
    const { result } = renderPermissions(
      {
        homeId: null,
        collaboratorsConnection: { edges: [] },
        ownerships: [],
        home: null,
      },
      'user-1',
    );

    expect(result.current.resolved).toBe(true);
  });

  // A role change edits only the collaborator, so the list details the screen
  // holds stay the same object.
  it("follows a change to the viewer's collaborator permissions", async () => {
    const collaborator: ShoppingListCollaboratorFragment = {
      __typename: 'ShoppingListCollaborator',
      id: 'c1',
      email: null,
      role: CollaboratorRole.Viewer,
      status: CollaboratorStatus.Active,
      collaboratorId: 'user-1',
      canAddItems: false,
      canRemoveItems: false,
      canEditItems: false,
      canMarkPurchased: true,
      invitedAt: '2025-01-01T00:00:00Z',
      collaborator: null,
    };
    const cache = seedCache([
      {
        data: collaborator,
        fragment: ShoppingListCollaboratorFragmentDoc,
        fragmentName: 'ShoppingListCollaboratorFragment',
      },
    ]);
    const listDetails = {
      homeId: null,
      collaboratorsConnection: { edges: [{ node: { id: 'c1' } }] },
      ownerships: [],
      home: null,
    };
    const { result } = renderHookWithApollo(
      () => useShoppingListPermissions(listDetails, 'user-1'),
      { cache },
    );
    expect(result.current.canAddItems).toBe(false);

    await act(async () => {
      cache.modify({
        id: cache.identify({
          __typename: 'ShoppingListCollaborator',
          id: 'c1',
        }),
        fields: { canAddItems: () => true },
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.canAddItems).toBe(true));
  });
});
