// "Not yet known" must not read as "allowed".
//
// The detail query is undefined for the first frames and STAYS undefined when it
// errors or the list is served from a cache that never held the permission data
// — so a default of all-allowed hands a viewer the add bar, swipe-to-delete and
// reorder, and offline those writes are queued and refused later.

import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
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
});
