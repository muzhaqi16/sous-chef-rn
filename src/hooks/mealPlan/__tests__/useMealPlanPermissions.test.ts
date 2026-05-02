import { renderHook } from '@testing-library/react-native';
import { useMealPlanPermissions } from '../useMealPlanPermissions';

let mockUserId: string | undefined = 'user-1';

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: mockUserId ? { id: mockUserId } : undefined,
  })),
}));

jest.mock('#utils/permissions/mealPlanPermissions', () => ({
  getMealPlanPermissions: jest.fn(
    (mealPlan: any, userId: string | undefined) => {
      // Simplified permission logic for testing
      if (!mealPlan.homeId) {
        return {
          canEdit: true,
          canDelete: true,
          canDuplicate: true,
          canGenerateShoppingList: true,
          canSaveAsTemplate: true,
        };
      }
      if (mealPlan.createdBy?.id === userId) {
        return {
          canEdit: true,
          canDelete: true,
          canDuplicate: true,
          canGenerateShoppingList: true,
          canSaveAsTemplate: true,
        };
      }
      const role = mealPlan.home?.myMembership?.role;
      if (role === 'GUEST') {
        return {
          canEdit: false,
          canDelete: false,
          canDuplicate: false,
          canGenerateShoppingList: true,
          canSaveAsTemplate: false,
        };
      }
      if (!role) {
        return {
          canEdit: false,
          canDelete: false,
          canDuplicate: false,
          canGenerateShoppingList: false,
          canSaveAsTemplate: false,
        };
      }
      return {
        canEdit: true,
        canDelete: true,
        canDuplicate: true,
        canGenerateShoppingList: true,
        canSaveAsTemplate: true,
      };
    },
  ),
}));

// Break circular dependency
jest.mock('../../../apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'user-1';
});

describe('useMealPlanPermissions', () => {
  it('returns all false when mealPlan is null', () => {
    const { result } = renderHook(() => useMealPlanPermissions(null));

    expect(result.current).toEqual({
      canEdit: false,
      canDelete: false,
      canDuplicate: false,
      canGenerateShoppingList: false,
      canSaveAsTemplate: false,
    });
  });

  it('returns full permissions for personal plan (no homeId)', () => {
    const { result } = renderHook(() =>
      useMealPlanPermissions({
        homeId: null,
        createdBy: { id: 'user-1' },
      } as any),
    );

    expect(result.current.canEdit).toBe(true);
    expect(result.current.canDelete).toBe(true);
    expect(result.current.canDuplicate).toBe(true);
  });

  it('returns full permissions for plan creator in home', () => {
    const { result } = renderHook(() =>
      useMealPlanPermissions({
        homeId: 'home-1',
        createdBy: { id: 'user-1' },
        home: { myMembership: { role: 'MEMBER' } },
      } as any),
    );

    expect(result.current.canEdit).toBe(true);
    expect(result.current.canDelete).toBe(true);
  });

  it('returns guest permissions for GUEST role', () => {
    const { result } = renderHook(() =>
      useMealPlanPermissions({
        homeId: 'home-1',
        createdBy: { id: 'other-user' },
        home: { myMembership: { role: 'GUEST' } },
      } as any),
    );

    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(false);
    expect(result.current.canGenerateShoppingList).toBe(true);
  });

  it('returns no permissions when no membership', () => {
    const { result } = renderHook(() =>
      useMealPlanPermissions({
        homeId: 'home-1',
        createdBy: { id: 'other-user' },
        home: { myMembership: null },
      } as any),
    );

    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(false);
    expect(result.current.canGenerateShoppingList).toBe(false);
  });
});
