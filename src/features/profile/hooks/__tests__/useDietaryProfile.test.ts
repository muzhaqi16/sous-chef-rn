'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import type { MockFor, MockPart } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  GetDietaryProfileDocument,
  UpdateDietaryProfileDocument,
  AddDietaryRestrictionDocument,
  RemoveDietaryRestrictionDocument,
  type GetDietaryProfileQuery,
} from '#operations/user/user.generated';
import {
  Cuisine,
  Diet,
  ErrorCode,
  Intolerance,
  RestrictionSeverity,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import type { RootState } from '#store/index';
import { alertService } from '#/services/alertService';
import { useDietaryProfile } from '../useDietaryProfile';

jest.mock('#store/useAppStore', () => {
  const getState = () => ({ user: { id: 'user-1' } } as Partial<RootState>);
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
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

/** The profile the query itself selects, so the fixture is checked against it. */
type DietaryProfile = NonNullable<
  NonNullable<GetDietaryProfileQuery['me']>['dietaryProfile']
>;

const mockProfileData: MockPart<DietaryProfile> = {
  __typename: 'DietaryProfile',
  id: 'dp-1',
  userId: 'user-1',
  preferredCuisines: [Cuisine.Italian],
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

type ProfileMockOverrides = MockPart<DietaryProfile>;

function buildGetProfileMock(
  profile: ProfileMockOverrides | null = mockProfileData,
): MockFor<typeof GetDietaryProfileDocument> {
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

function buildUpdateProfileMock(): MockFor<
  typeof UpdateDietaryProfileDocument
> {
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

function buildAddRestrictionMock(): MockFor<
  typeof AddDietaryRestrictionDocument
> {
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

function buildRemoveRestrictionMock(): MockFor<
  typeof RemoveDietaryRestrictionDocument
> {
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
    expect(result.current.profile?.preferredCuisines).toEqual(['ITALIAN']);
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

  it('offers the server defaults to edit when the user has no profile row', async () => {
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock(null)],
    });

    await waitFor(() => {
      expect(result.current.editableProfile).not.toBeNull();
    });

    expect(result.current.profile).toBeNull();
    expect(result.current.editableProfile).toMatchObject({
      restrictions: [],
      mealsPerDay: 3,
      snacksPerDay: 1,
      maxPrepTimeMinutes: 45,
      maxCookTimeMinutes: 60,
    });
  });

  it('has nothing to edit before the profile has been read', () => {
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock(null)],
    });

    expect(result.current.editableProfile).toBeNull();
  });

  it('creates the profile once before parallel first restrictions, and links it to the user', async () => {
    const createMock = recordMock(UpdateDietaryProfileDocument, {
      data: {
        updateDietaryProfile: {
          __typename: 'UpdateDietaryProfilePayload',
          dietaryProfile: {
            __typename: 'DietaryProfile',
            id: 'dp-new',
            userId: 'user-1',
            restrictions: [],
            user: {
              __typename: 'User',
              id: 'user-1',
              dietaryProfile: { __typename: 'DietaryProfile', id: 'dp-new' },
            },
          },
        },
      },
    });
    const secondAdd = buildAddRestrictionMock();
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [
        buildGetProfileMock(null),
        createMock.mock,
        buildAddRestrictionMock(),
        {
          ...secondAdd,
          result: {
            data: {
              addRestriction: {
                __typename: 'AddRestrictionPayload',
                dietaryRestriction: {
                  __typename: 'DietaryRestriction',
                  id: 'r-second',
                  diet: null,
                  intolerance: Intolerance.Gluten,
                  healthGoal: null,
                  severity: RestrictionSeverity.Allergy,
                  notes: null,
                  appliesToHomeId: null,
                  createdAt: '2025-01-01T00:00:00.000Z',
                },
              },
            },
          },
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.editableProfile).not.toBeNull();
    });

    let outcomes: boolean[] = [];
    await act(async () => {
      outcomes = await Promise.all([
        result.current.addDietaryRestriction(
          { diet: Diet.Vegan },
          RestrictionSeverity.Allergy,
        ),
        result.current.addDietaryRestriction(
          { intolerance: Intolerance.Gluten },
          RestrictionSeverity.Allergy,
        ),
      ]);
    });

    expect(outcomes).toEqual([true, true]);
    expect(createMock.fired).toHaveLength(1);
    await waitFor(() => {
      expect(result.current.profile?.id).toBe('dp-new');
    });
    expect(result.current.profile?.restrictions.map(r => r.id).sort()).toEqual([
      'r-new',
      'r-second',
    ]);
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

  // A refusal member is `data`, so `!!result.data` read it as success: the
  // sheet closed on a change the server refused, and nothing was said.
  it('updateDietaryProfile reports a refusal as a failure, once', async () => {
    const refused: MockFor<typeof UpdateDietaryProfileDocument> = {
      request: { query: UpdateDietaryProfileDocument, variables: () => true },
      result: {
        data: {
          updateDietaryProfile: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'SERVER PROSE',
            field: null,
          },
        },
      },
    };
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock(), refused],
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success = true;
    await act(async () => {
      success = await result.current.updateDietaryProfile({ mealsPerDay: 5 });
    });

    expect(success).toBe(false);
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(alertService.alert).not.toHaveBeenCalledWith(
      expect.anything(),
      'SERVER PROSE',
    );
    // The permanent local write is reverted.
    await waitFor(() => expect(result.current.profile?.mealsPerDay).toBe(3));
  });

  // Both callers alert on the false return, and a bulk add would stack one
  // alert per restriction on top of theirs.
  it('addDietaryRestriction leaves the alert to its caller', async () => {
    const refused: MockFor<typeof AddDietaryRestrictionDocument> = {
      request: { query: AddDietaryRestrictionDocument, variables: () => true },
      result: {
        data: {
          addRestriction: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'SERVER PROSE',
            field: null,
          },
        },
      },
    };
    const { result } = renderHookWithApollo(() => useDietaryProfile(), {
      operationMocks: [buildGetProfileMock(), refused],
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success = true;
    await act(async () => {
      success = await result.current.addDietaryRestriction(
        { diet: Diet.Vegan },
        RestrictionSeverity.Preference,
      );
    });

    expect(success).toBe(false);
    expect(alertService.alert).not.toHaveBeenCalled();
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

  // RESOURCE_NOT_FOUND arrives top-level with no payload for an `update`.
  const goneResults: Array<
    [string, MockFor<typeof RemoveDietaryRestrictionDocument>['result']]
  > = [
    [
      'as a top-level code',
      {
        data: null,
        errors: [
          {
            message: 'gone',
            extensions: { code: TopLevelErrorCode.ResourceNotFound },
          },
        ],
      },
    ],
    [
      'as data',
      {
        data: {
          removeRestriction: {
            __typename: 'NotFoundError',
            code: ErrorCode.NotFound,
          },
        },
      },
    ],
  ];
  it.each(goneResults)(
    'takes off a restriction the server says is already gone %s',
    async (_label, result) => {
      const gone: MockFor<typeof RemoveDietaryRestrictionDocument> = {
        request: {
          query: RemoveDietaryRestrictionDocument,
          variables: () => true,
        },
        result,
      };
      const { result: hook } = renderHookWithApollo(() => useDietaryProfile(), {
        operationMocks: [buildGetProfileMock(), gone],
      });
      await waitFor(() => {
        expect(hook.current.profile?.restrictions).toHaveLength(1);
      });

      let success = false;
      await act(async () => {
        success = await hook.current.removeDietaryRestriction('r1');
      });

      expect(success).toBe(true);
      await waitFor(() => {
        expect(hook.current.profile?.restrictions).toHaveLength(0);
      });
      expect(alertService.alert).not.toHaveBeenCalled();
    },
  );
});
