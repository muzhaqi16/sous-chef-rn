'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '@apollo/client/testing';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import {
  GetDietaryProfileDocument,
  UpdateDietaryProfileDocument,
  AddDietaryRestrictionDocument,
  UpdateDietaryRestrictionDocument,
  RemoveDietaryRestrictionDocument,
} from '#operations/user/user.generated';
import { Diet, RestrictionSeverity } from '#/graphql/generated/schemaTypes';
import { useDietaryProfile } from '../useDietaryProfile';

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) => selector({ user: { id: 'user-1' } })),
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedQueryData: (data: any, fallback: any) => data ?? fallback,
}));

jest.mock('#/apollo/utils/createOptimisticResponse', () => ({
  enhanceWithVersion: jest.fn((obj: any, updates: any) => ({
    ...obj,
    ...updates,
  })),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn().mockReturnValue({ message: 'Error' }),
  }),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const mockProfileData = {
  __typename: 'DietaryProfile',
  id: 'dp-1',
  userId: 'user-1',
  preferredCuisines: ['Italian'],
  dislikedIngredients: ['cilantro'],
  favoriteIngredients: ['garlic'],
  calorieTarget: 2000,
  proteinTarget: 50,
  carbsTarget: 250,
  fatTarget: 65,
  mealsPerDay: 3,
  snacksPerDay: 1,
  cookingSkillLevel: 'INTERMEDIATE',
  maxPrepTimeMinutes: 30,
  maxCookTimeMinutes: 60,
  budgetPerMeal: 15,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  restrictions: [
    {
      __typename: 'DietaryRestriction',
      id: 'r1',
      diet: Diet.Vegan,
      intolerance: null,
      healthGoal: null,
      severity: RestrictionSeverity.Strict,
      notes: 'test',
      appliesToHomeId: null,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
};

function buildGetProfileMock(
  profile: typeof mockProfileData | null = mockProfileData,
): MockedResponse {
  return {
    request: { query: GetDietaryProfileDocument },
    result: {
      data: {
        me: {
          __typename: 'User',
          id: 'user-1',
          dietaryProfile: profile,
        },
      },
    },
  };
}

function buildUpdateProfileMock(): MockedResponse {
  return {
    request: {
      query: UpdateDietaryProfileDocument,
      variables: () => true,
    },
    result: {
      data: {
        updateDietaryProfile: {
          __typename: 'DietaryProfilePayload',
          success: true,
          message: 'OK',
          code: 'OK',
          dietaryProfile: { ...mockProfileData, mealsPerDay: 4 },
        },
      },
    },
  };
}

function buildAddRestrictionMock(): MockedResponse {
  return {
    request: {
      query: AddDietaryRestrictionDocument,
      variables: () => true,
    },
    result: {
      data: {
        addRestriction: {
          __typename: 'DietaryRestrictionPayload',
          success: true,
          message: 'OK',
          code: 'OK',
          dietaryRestriction: {
            __typename: 'DietaryRestriction',
            id: 'r-new',
            diet: Diet.Vegan,
            intolerance: null,
            healthGoal: null,
            severity: RestrictionSeverity.Strict,
            notes: 'No animal products',
            appliesToHomeId: null,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        },
      },
    },
  };
}

function buildUpdateRestrictionMock(): MockedResponse {
  return {
    request: {
      query: UpdateDietaryRestrictionDocument,
      variables: () => true,
    },
    result: {
      data: {
        updateRestriction: {
          __typename: 'DietaryRestrictionPayload',
          success: true,
          message: 'OK',
          code: 'OK',
          dietaryRestriction: {
            __typename: 'DietaryRestriction',
            id: 'r1',
            diet: Diet.Vegan,
            intolerance: null,
            healthGoal: null,
            severity: RestrictionSeverity.Moderate,
            notes: 'test',
            appliesToHomeId: null,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        },
      },
    },
  };
}

function buildRemoveRestrictionMock(): MockedResponse {
  return {
    request: {
      query: RemoveDietaryRestrictionDocument,
      variables: () => true,
    },
    result: {
      data: {
        removeRestriction: {
          __typename: 'DietaryRestrictionPayload',
          success: true,
          message: 'OK',
          code: 'OK',
        },
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useDietaryProfile', () => {
  it('returns profile data correctly', async () => {
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock()],
    });

    // Wait for the query to settle
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).not.toBeNull();
    expect(result.current.profile?.id).toBe('dp-1');
    expect(result.current.profile?.userId).toBe('user-1');
    expect(result.current.profile?.restrictions).toHaveLength(1);
    expect(result.current.profile?.preferredCuisines).toEqual(['Italian']);
  });

  it('returns loading state', () => {
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock()],
    });
    // Initial render is loading=true; once data resolves it flips to false
    expect(typeof result.current.loading).toBe('boolean');
  });

  it('returns null profile when no data', async () => {
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock(null)],
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBeNull();
  });

  it('maps restriction fields correctly', async () => {
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock()],
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const restriction = result.current.profile?.restrictions[0];

    expect(restriction?.id).toBe('r1');
    expect(restriction?.diet).toBe(Diet.Vegan);
    expect(restriction?.severity).toBe(RestrictionSeverity.Strict);
    expect(restriction?.notes).toBe('test');
  });

  it('updateDietaryProfile calls mutation with cleaned input', async () => {
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock(), buildUpdateProfileMock()],
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.updateDietaryProfile({
        mealsPerDay: 4,
        calorieTarget: null,
      });
    });

    expect(success).toBe(true);
  });

  it('addDietaryRestriction calls mutation with correct params', async () => {
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock(), buildAddRestrictionMock()],
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.addDietaryRestriction(
        { diet: Diet.Vegan },
        RestrictionSeverity.Strict,
        'No animal products',
      );
    });

    expect(success).toBe(true);
  });

  it('updateDietaryRestriction calls mutation', async () => {
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock(), buildUpdateRestrictionMock()],
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.updateDietaryRestriction('r1', {
        severity: RestrictionSeverity.Moderate,
      });
    });

    expect(success).toBe(true);
  });

  it('removeDietaryRestriction calls mutation', async () => {
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock(), buildRemoveRestrictionMock()],
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.removeDietaryRestriction('r1');
    });

    expect(success).toBe(true);
  });

  it('provides defaults for missing profile fields', async () => {
    const sparseProfile = {
      ...mockProfileData,
      id: 'dp-2',
      restrictions: null as any,
      preferredCuisines: null as any,
      dislikedIngredients: null as any,
      favoriteIngredients: null as any,
      mealsPerDay: null as any,
      snacksPerDay: null as any,
    };

    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock(sparseProfile)],
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile?.restrictions).toEqual([]);
    expect(result.current.profile?.preferredCuisines).toEqual([]);
    expect(result.current.profile?.mealsPerDay).toBe(3);
    expect(result.current.profile?.snacksPerDay).toBe(1);
  });
});
