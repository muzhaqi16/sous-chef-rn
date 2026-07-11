import { renderHook } from '@testing-library/react-native';
import type { getMealPlanPermissions } from '#utils/permissions/mealPlanPermissions';
import type { MealPlanDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import type { MealPlanMain_MealPlanFragment } from '#features/mealPlan/screens/MealPlanMain.generated';
import { useMealPlanPermissions } from '../useMealPlanPermissions';

type MealPlanLike = MealPlanDisplayFragment | MealPlanMain_MealPlanFragment;

jest.mock('#utils/permissions/mealPlanPermissions', () => ({
  getMealPlanPermissions: jest.fn(
    (
      mealPlan: Parameters<typeof getMealPlanPermissions>[0],
      userId: string | undefined,
    ) => {
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
      if (mealPlan.user?.id === userId) {
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
jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
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
        user: { id: 'user-1' },
      } as Partial<MealPlanLike> as MealPlanLike),
    );

    expect(result.current.canEdit).toBe(true);
    expect(result.current.canDelete).toBe(true);
    expect(result.current.canDuplicate).toBe(true);
  });

  it('returns full permissions for plan owner in home', () => {
    const { result } = renderHook(() =>
      useMealPlanPermissions({
        homeId: 'home-1',
        user: { id: 'user-1' },
        home: { myMembership: { role: 'MEMBER' } },
      } as Partial<MealPlanLike> as MealPlanLike),
    );

    expect(result.current.canEdit).toBe(true);
    expect(result.current.canDelete).toBe(true);
  });

  it('returns guest permissions for GUEST role', () => {
    const { result } = renderHook(() =>
      useMealPlanPermissions({
        homeId: 'home-1',
        user: { id: 'other-user' },
        home: { myMembership: { role: 'GUEST' } },
      } as Partial<MealPlanLike> as MealPlanLike),
    );

    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(false);
    expect(result.current.canGenerateShoppingList).toBe(true);
  });

  it('returns no permissions when no membership', () => {
    const { result } = renderHook(() =>
      useMealPlanPermissions({
        homeId: 'home-1',
        user: { id: 'other-user' },
        home: { myMembership: null },
      } as Partial<MealPlanLike> as MealPlanLike),
    );

    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(false);
    expect(result.current.canGenerateShoppingList).toBe(false);
  });
});
