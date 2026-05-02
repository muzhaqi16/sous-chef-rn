'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { useDietaryProfile } from '../useDietaryProfile';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) => selector({ user: { id: 'user-1' } })),
}));

const mockUpdateProfile = jest.fn();
const mockAddRestriction = jest.fn();
const mockUpdateRestriction = jest.fn();
const mockRemoveRestriction = jest.fn();

const mockProfileData = {
  id: 'dp-1',
  userId: 'user-1',
  restrictions: [
    {
      id: 'r1',
      diet: 'VEGAN',
      intolerance: null,
      healthGoal: null,
      severity: 'STRICT',
      notes: 'test',
      appliesToHomeId: null,
    },
  ],
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
};

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useQuery: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'GetDietaryProfile') {
      return {
        data: { me: { dietaryProfile: mockProfileData } },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      };
    }
    return { data: undefined, loading: false, error: undefined };
  }),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'UpdateDietaryProfile') return [mockUpdateProfile, {}];
    if (opName === 'AddDietaryRestriction') return [mockAddRestriction, {}];
    if (opName === 'UpdateDietaryRestriction')
      return [mockUpdateRestriction, {}];
    if (opName === 'RemoveDietaryRestriction')
      return [mockRemoveRestriction, {}];
    return [jest.fn(), {}];
  }),
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useDietaryProfile', () => {
  it('returns profile data correctly', () => {
    const { result } = renderHook(() => useDietaryProfile());

    expect(result.current.profile).not.toBeNull();
    expect(result.current.profile?.id).toBe('dp-1');
    expect(result.current.profile?.userId).toBe('user-1');
    expect(result.current.profile?.restrictions).toHaveLength(1);
    expect(result.current.profile?.preferredCuisines).toEqual(['Italian']);
  });

  it('returns loading state', () => {
    const { result } = renderHook(() => useDietaryProfile());
    expect(result.current.loading).toBe(false);
  });

  it('returns null profile when no data', () => {
    const { useQuery } = require('@apollo/client/react');
    (useQuery as jest.Mock).mockReturnValueOnce({
      data: null,
      loading: false,
      networkStatus: 7,
    });

    const { result } = renderHook(() => useDietaryProfile());
    expect(result.current.profile).toBeNull();
  });

  it('maps restriction fields correctly', () => {
    const { useQuery } = require('@apollo/client/react');
    (useQuery as jest.Mock).mockReturnValueOnce({
      data: { me: { dietaryProfile: mockProfileData } },
      loading: false,
      networkStatus: 7,
    });

    const { result } = renderHook(() => useDietaryProfile());
    const restriction = result.current.profile?.restrictions[0];

    expect(restriction?.id).toBe('r1');
    expect(restriction?.diet).toBe('VEGAN');
    expect(restriction?.severity).toBe('STRICT');
    expect(restriction?.notes).toBe('test');
  });

  it('updateDietaryProfile calls mutation with cleaned input', async () => {
    mockUpdateProfile.mockResolvedValue({
      data: { updateDietaryProfile: true },
    });
    const { result } = renderHook(() => useDietaryProfile());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.updateDietaryProfile({
        mealsPerDay: 4,
        calorieTarget: null,
      });
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({ mealsPerDay: 4 }),
      },
    });
    expect(success).toBe(true);
  });

  it('addDietaryRestriction calls mutation with correct params', async () => {
    mockAddRestriction.mockResolvedValue({ data: { addRestriction: true } });
    const { result } = renderHook(() => useDietaryProfile());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.addDietaryRestriction(
        { diet: 'VEGAN' as any },
        'STRICT' as any,
        'No animal products',
      );
    });

    expect(mockAddRestriction).toHaveBeenCalledWith({
      variables: {
        input: {
          diet: 'VEGAN',
          severity: 'STRICT',
          notes: 'No animal products',
          appliesToHomeId: undefined,
        },
      },
    });
    expect(success).toBe(true);
  });

  it('updateDietaryRestriction calls mutation', async () => {
    mockUpdateRestriction.mockResolvedValue({
      data: { updateRestriction: true },
    });
    const { result } = renderHook(() => useDietaryProfile());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.updateDietaryRestriction('r1', {
        severity: 'MODERATE' as any,
      });
    });

    expect(mockUpdateRestriction).toHaveBeenCalledWith({
      variables: {
        input: { id: 'r1', severity: 'MODERATE' },
      },
    });
    expect(success).toBe(true);
  });

  it('removeDietaryRestriction calls mutation', async () => {
    mockRemoveRestriction.mockResolvedValue({
      data: { removeRestriction: true },
    });
    const { result } = renderHook(() => useDietaryProfile());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.removeDietaryRestriction('r1');
    });

    expect(mockRemoveRestriction).toHaveBeenCalledWith({
      variables: { input: { id: 'r1' } },
    });
    expect(success).toBe(true);
  });

  it('provides defaults for missing profile fields', () => {
    const { useQuery } = require('@apollo/client/react');
    (useQuery as jest.Mock).mockReturnValueOnce({
      data: {
        me: {
          dietaryProfile: {
            id: 'dp-2',
            userId: 'user-1',
            restrictions: null,
            preferredCuisines: null,
            dislikedIngredients: null,
            favoriteIngredients: null,
            mealsPerDay: null,
            snacksPerDay: null,
          },
        },
      },
      loading: false,
      networkStatus: 7,
    });

    const { result } = renderHook(() => useDietaryProfile());
    expect(result.current.profile?.restrictions).toEqual([]);
    expect(result.current.profile?.preferredCuisines).toEqual([]);
    expect(result.current.profile?.mealsPerDay).toBe(3);
    expect(result.current.profile?.snacksPerDay).toBe(1);
  });
});
