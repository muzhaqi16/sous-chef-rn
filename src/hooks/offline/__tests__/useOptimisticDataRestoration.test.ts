'use no memo';
import { renderHook } from '@testing-library/react-native';
import { useOptimisticDataRestoration, useOptimisticDataRestorationMultiple } from '../useOptimisticDataRestoration';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));

const mockGetAllForType = jest.fn(() => new Map());
const mockBatch = jest.fn();
jest.mock('#/apollo/client', () => ({
  client: {
    cache: {
      batch: (opts: any) => mockBatch(opts),
      identify: jest.fn((obj: any) => `${obj.__typename}:${obj.id}`),
      modify: jest.fn(),
      readFragment: jest.fn(() => null),
    },
  },
}));
jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    getAllForType: (...args: any[]) => (mockGetAllForType as any)(...args),
  },
}));
jest.mock('#/hooks/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

// Mock startTransition to execute synchronously
jest.spyOn(require('react'), 'startTransition').mockImplementation((fn: any) => fn());

describe('useOptimisticDataRestoration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when no persisted data', () => {
    mockGetAllForType.mockReturnValue(new Map());
    renderHook(() => useOptimisticDataRestoration('ShoppingListItem'));
    expect(mockGetAllForType).toHaveBeenCalledWith('ShoppingListItem');
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it('applies updates when persisted data exists', () => {
    const updates = new Map([['item-1', { checked: true }]]);
    mockGetAllForType.mockReturnValue(updates);
    renderHook(() => useOptimisticDataRestoration('ShoppingListItem'));
    expect(mockBatch).toHaveBeenCalled();
  });

  it('skips when disabled', () => {
    renderHook(() => useOptimisticDataRestoration('ShoppingListItem', false));
    expect(mockGetAllForType).not.toHaveBeenCalled();
  });
});

describe('useOptimisticDataRestorationMultiple', () => {
  beforeEach(() => jest.clearAllMocks());

  it('processes multiple entity types', () => {
    mockGetAllForType.mockReturnValue(new Map());
    renderHook(() =>
      useOptimisticDataRestorationMultiple(['ShoppingList', 'ShoppingListItem']),
    );
    expect(mockBatch).toHaveBeenCalled();
  });
});
