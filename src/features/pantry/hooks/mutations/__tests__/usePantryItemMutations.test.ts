'use no memo';

import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  UpdatePantryItemDocument,
  DeletePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import type { VersionedEntity } from '#/apollo/utils/createOptimisticResponse';
import type { PantryItemUpdate } from '../../pantryDataTypes';
import { usePantryItemMutations } from '../usePantryItemMutations';

/** Minimal config shape the mocked CRUD operation reads at call time. */
interface MockUpdateConfig {
  itemId: string;
  mutation: (options: {
    variables: { id: string; input: PantryItemUpdate };
  }) => Promise<unknown>;
}

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/errorService');

jest.mock('#/utils/generateId', () => ({
  generateId: () => 'mock-id',
}));

jest.mock('#/apollo/utils/createOptimisticResponse', () => ({
  enhanceWithVersion: jest.fn(
    (obj: VersionedEntity, updates: Record<string, unknown>) => ({
      ...obj,
      ...updates,
    }),
  ),
  createOptimisticEntity: jest.fn(
    (typename: string, id: string, fields: Record<string, unknown>) => ({
      __typename: typename,
      id,
      ...fields,
    }),
  ),
  buildOptimisticMutationResponse: jest.fn(
    (
      opName: string,
      payloadTypename: string,
      fields: Record<string, unknown>,
    ) => ({
      __typename: 'Mutation',
      [opName]: { __typename: payloadTypename, ...fields },
    }),
  ),
}));

jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn().mockReturnValue(false),
  getVersionConflictMessage: jest.fn().mockReturnValue('Conflict message'),
}));

jest.mock('#/hooks/utils/useCrudOperations', () => ({
  useCrudOperations: () => ({
    createUpdateOperation: jest.fn(
      (config: MockUpdateConfig) => async (updates: PantryItemUpdate) => {
        await config.mutation({
          variables: { id: config.itemId, input: updates },
        });
      },
    ),
  }),
}));

jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    registerPendingDelete: jest.fn(),
    unregisterPendingDelete: jest.fn(),
  },
}));

jest.mock('#/apollo/utils/pantryCacheUpdaters', () => ({
  addToPantryItemsCache: jest.fn(),
  removeFromPantryItemsCache: jest.fn(),
  adjustPantryItemCount: jest.fn(),
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const defaultOptions = {
  pantryId: 'pantry-1',
  refetch: jest.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  jest.clearAllMocks();
});

function updateMock() {
  return recordMock(UpdatePantryItemDocument, {
    data: {
      updatePantryItem: {
        __typename: 'PantryItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        pantryItem: { __typename: 'PantryItem', id: 'item-1' },
      },
    },
  });
}

function deleteMock() {
  return recordMock(DeletePantryItemDocument, {
    data: {
      deletePantryItem: {
        __typename: 'PantryItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        pantryItem: { __typename: 'PantryItem', id: 'item-1' },
      },
    },
  });
}

function deleteErrorMock() {
  return recordMock(DeletePantryItemDocument, {
    error: new Error('Delete failed'),
  });
}

describe('usePantryItemMutations', () => {
  it('returns updateItem and removeItem (adds live on the dedicated add surfaces)', () => {
    const { result } = renderHookWithApollo(() =>
      usePantryItemMutations(defaultOptions),
    );

    expect(typeof result.current.updateItem).toBe('function');
    expect(typeof result.current.removeItem).toBe('function');
    // The caller-less addItem was removed: it bypassed the
    // DuplicatePantryItemError recovery flow the contract requires on every
    // add path.
    expect((result.current as Record<string, unknown>).addItem).toBeUndefined();
  });

  it('removeItem registers pending delete before mutation', async () => {
    const {
      subscriptionService,
    } = require('#/services/subscriptions/SubscriptionService');
    const m = deleteMock();

    const { result } = renderHookWithApollo(
      () => usePantryItemMutations(defaultOptions),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    expect(subscriptionService.registerPendingDelete).toHaveBeenCalledWith(
      'item-1',
      'pantry-1',
      'PantryItem',
      'Pantry',
      'itemsConnection',
    );
  });

  it('removeItem unregisters pending delete after success', async () => {
    const {
      subscriptionService,
    } = require('#/services/subscriptions/SubscriptionService');
    const m = deleteMock();

    const { result } = renderHookWithApollo(
      () => usePantryItemMutations(defaultOptions),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    expect(subscriptionService.unregisterPendingDelete).toHaveBeenCalledWith(
      'item-1',
    );
  });

  it('removeItem does nothing when pantryId is undefined', async () => {
    const m = deleteMock();
    const { result } = renderHookWithApollo(
      () =>
        usePantryItemMutations({
          ...defaultOptions,
          pantryId: undefined,
        }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    expect(m.fired).toEqual([]);
  });

  it('removeItem unregisters pending delete on error', async () => {
    const {
      subscriptionService,
    } = require('#/services/subscriptions/SubscriptionService');
    const m = deleteErrorMock();

    const { result } = renderHookWithApollo(
      () => usePantryItemMutations(defaultOptions),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      try {
        await result.current.removeItem('item-1');
      } catch {
        // Expected - removeItem re-throws the error
      }
    });

    expect(subscriptionService.unregisterPendingDelete).toHaveBeenCalledWith(
      'item-1',
    );
  });

  it('updateItem calls the update mutation via createUpdateOperation', async () => {
    const m = updateMock();
    const { result } = renderHookWithApollo(
      () => usePantryItemMutations(defaultOptions),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.updateItem('item-1', {
        itemName: 'Updated Milk',
      });
    });

    expect(m.fired.length).toBeGreaterThanOrEqual(1);
  });
});
