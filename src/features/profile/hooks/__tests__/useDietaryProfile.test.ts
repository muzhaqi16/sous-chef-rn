'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import {
  GetDietaryProfileDocument,
  UpdateDietaryProfileDocument,
  AddDietaryRestrictionDocument,
  UpdateDietaryRestrictionDocument,
  RemoveDietaryRestrictionDocument,
} from '#operations/user/user.generated';
import { Diet, RestrictionSeverity } from '#/graphql/generated/schemaTypes';
import type { RootState } from '#store/index';
import { toastService } from '#/services/toastService';
import { useDietaryProfile } from '../useDietaryProfile';

// `useIsApiUnavailable` reads the network slice through the same store, so the
// mocked state must carry a reachable API or every mutation hits the offline
// guard. `networkState` is mutable so a test can flip the hook offline.
const networkState = { isOnline: true, apiReachable: true as boolean | null };

jest.mock('#store/useAppStore', () => {
  const getState = () =>
    ({ user: { id: 'user-1' }, ...networkState } as Partial<RootState>);
  return {
    useAppStore: jest.fn(
      <T>(selector: (state: RootState) => T): T =>
        selector(getState() as RootState),
    ),
    useUser: () => getState().user,
    useUserId: () => getState().user?.id,
  };
});

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedQueryData: <T>(data: T | undefined, fallback: T): T =>
    data ?? fallback,
}));

jest.mock('#/apollo/utils/createOptimisticResponse', () => ({
  enhanceWithVersion: jest.fn(
    (obj: Record<string, unknown>, updates: Record<string, unknown>) => ({
      ...obj,
      ...updates,
    }),
  ),
  buildOptimisticMutationResponse: jest.fn(
    (opName: string, typeName: string, fields: Record<string, unknown>) => ({
      __typename: 'Mutation',
      [opName]: { __typename: typeName, ...fields },
    }),
  ),
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#/utils/errorHandlers', () => ({
  handleMutationError: jest.fn(),
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
      severity: RestrictionSeverity.Allergy,
      notes: 'test',
      appliesToHomeId: null,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
};

type ProfileMockOverrides = {
  [K in keyof typeof mockProfileData]: (typeof mockProfileData)[K] | null;
};

function buildGetProfileMock(
  profile: Partial<ProfileMockOverrides> | null = mockProfileData,
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
          __typename: 'UpdateDietaryProfilePayload',
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
          __typename: 'AddRestrictionPayload',
          dietaryRestriction: {
            __typename: 'DietaryRestriction',
            id: 'r-new',
            diet: Diet.Vegan,
            intolerance: null,
            healthGoal: null,
            severity: RestrictionSeverity.Allergy,
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
          __typename: 'UpdateRestrictionPayload',
          dietaryRestriction: {
            __typename: 'DietaryRestriction',
            id: 'r1',
            diet: Diet.Vegan,
            intolerance: null,
            healthGoal: null,
            severity: RestrictionSeverity.Preference,
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
          __typename: 'RemoveRestrictionPayload',
          dietaryRestriction: {
            __typename: 'DietaryRestriction',
            id: 'r1',
          },
        },
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  networkState.isOnline = true;
  networkState.apiReachable = true;
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
    expect(restriction?.severity).toBe(RestrictionSeverity.Allergy);
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
        RestrictionSeverity.Allergy,
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
        severity: RestrictionSeverity.Preference,
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

  describe('when the API is unavailable', () => {
    // Dietary preferences are online-only: no offline queueing, so each write
    // refuses up front with localized copy instead of half-applying.
    const goOffline = () => {
      networkState.isOnline = false;
      networkState.apiReachable = null;
    };

    it('exposes isApiUnavailable so the screen can gate the affordance', async () => {
      goOffline();
      const { result } = renderHookWithApollo(() => useDietaryProfile(), {
        operationMocks: [buildGetProfileMock()],
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isApiUnavailable).toBe(true);
    });

    it('refuses every write without firing a mutation', async () => {
      const errorToast = jest.spyOn(toastService, 'error').mockImplementation();
      goOffline();

      // No mutation mocks: an attempted mutation would reject as unmocked.
      const { result } = renderHookWithApollo(() => useDietaryProfile(), {
        operationMocks: [buildGetProfileMock()],
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const outcomes: boolean[] = [];
      await act(async () => {
        outcomes.push(
          await result.current.updateDietaryProfile({ mealsPerDay: 4 }),
        );
        outcomes.push(
          await result.current.addDietaryRestriction(
            { diet: Diet.Vegan },
            RestrictionSeverity.Allergy,
          ),
        );
        outcomes.push(
          await result.current.updateDietaryRestriction('r1', {
            severity: RestrictionSeverity.Preference,
          }),
        );
        outcomes.push(await result.current.removeDietaryRestriction('r1'));
      });

      expect(outcomes).toEqual([false, false, false, false]);
      expect(errorToast).toHaveBeenCalledTimes(4);
      errorToast.mockRestore();
    });
  });

  it('provides defaults for missing profile fields', async () => {
    const sparseProfile: Partial<ProfileMockOverrides> = {
      ...mockProfileData,
      id: 'dp-2',
      restrictions: null,
      preferredCuisines: null,
      dislikedIngredients: null,
      favoriteIngredients: null,
      mealsPerDay: null,
      snacksPerDay: null,
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
