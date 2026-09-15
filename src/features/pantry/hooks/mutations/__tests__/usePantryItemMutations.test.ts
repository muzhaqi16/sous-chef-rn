'use no memo';

import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { DeletePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { usePantryItemMutations } from '../usePantryItemMutations';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/errorService');

jest.mock('#/utils/generateId', () => ({
  generateId: () => 'mock-id',
}));

jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    registerPendingDelete: jest.fn(),
    unregisterPendingDelete: jest.fn(),
  },
}));

jest.mock('#features/pantry/cache/items', () => ({
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

function deleteMock() {
  return recordMock(DeletePantryItemDocument, {
    data: {
      deletePantryItem: {
        __typename: 'DeletePantryItemPayload' as const,
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

  it('removeItem treats an item already gone as removed, not as a failure', async () => {
    // Another member deleted it first: the outcome asked for is the outcome
    // that exists, so there is nothing to restore and nothing to report.
    const { alertService } = require('#/services/alertService');
    const gone = recordMock(DeletePantryItemDocument, {
      data: {
        deletePantryItem: {
          __typename: 'NotFoundError',
          code: ErrorCode.NotFound,
        },
      },
    });

    const { result } = renderHookWithApollo(
      () => usePantryItemMutations(defaultOptions),
      { operationMocks: [gone.mock] },
    );

    let removed: boolean | undefined;
    await act(async () => {
      removed = await result.current.removeItem('item-1');
    });

    expect(removed).toBe(true);
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(defaultOptions.refetch).not.toHaveBeenCalled();
  });
});
