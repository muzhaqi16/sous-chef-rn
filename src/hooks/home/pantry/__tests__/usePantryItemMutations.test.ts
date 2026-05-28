'use no memo';

import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreatePantryItemDocument,
  UpdatePantryItemDocument,
  DeletePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { usePantryItemMutations } from '../usePantryItemMutations';

jest.mock('../../../../apollo/links/tokenScheduler');
jest.mock('../../../../apollo/links/refreshToken');

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn().mockReturnValue({ message: 'Error' }),
  }),
}));

jest.mock('#/utils/generateId', () => ({
  generateId: () => 'mock-id',
}));

jest.mock('#/apollo/utils/createOptimisticResponse', () => ({
  enhanceWithVersion: jest.fn((obj: any, updates: any) => ({
    ...obj,
    ...updates,
  })),
  createOptimisticEntity: jest.fn(
    (typename: string, id: string, fields: any) => ({
      __typename: typename,
      id,
      ...fields,
    }),
  ),
  buildOptimisticMutationResponse: jest.fn(
    (opName: string, payloadTypename: string, fields: any) => ({
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
    createAddOperation: jest.fn((config: any) => async (input: any) => {
      const transformed = config.transformInput(input);
      await config.mutation({ variables: { input: transformed } });
    }),
    createUpdateOperation: jest.fn((config: any) => async (updates: any) => {
      await config.mutation({
        variables: { id: config.itemId, input: updates },
      });
    }),
  }),
}));

jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    registerPendingDelete: jest.fn(),
    unregisterPendingDelete: jest.fn(),
  },
}));

jest.mock('../utils', () => ({
  addToPantryItemsCache: jest.fn(),
  removeFromPantryItemsCache: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers');

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

function createMock() {
  return recordMock(CreatePantryItemDocument, {
    data: {
      createPantryItem: {
        __typename: 'PantryItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        pantryItem: { __typename: 'PantryItem', id: 'new-1' },
      },
    },
  });
}

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
  it('returns addItem, updateItem, and removeItem', () => {
    const { result } = renderHookWithApollo(() =>
      usePantryItemMutations(defaultOptions),
    );

    expect(typeof result.current.addItem).toBe('function');
    expect(typeof result.current.updateItem).toBe('function');
    expect(typeof result.current.removeItem).toBe('function');
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
      } as any);
    });

    expect(m.fired.length).toBeGreaterThanOrEqual(1);
  });

  it('addItem calls createAddOperation with transformed input', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => usePantryItemMutations(defaultOptions),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.addItem({
        itemName: 'Bread',
        quantity: 2,
        storageState: 'FRESH' as any,
      } as any);
    });

    expect(m.fired.length).toBeGreaterThanOrEqual(1);
  });
});
