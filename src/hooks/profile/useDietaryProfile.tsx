import {useCallback} from 'react';
import {useStore} from '#store';
import {
  useGetDietaryProfileQuery,
  useUpdateDietaryProfileMutation,
  useAddDietaryRestrictionMutation,
  useUpdateDietaryRestrictionMutation,
  useRemoveDietaryRestrictionMutation,
  Diet,
  Intolerance,
  HealthGoal,
  RestrictionSeverity,
} from '#generated';

export interface DietaryRestriction {
  id: string;
  diet?: Diet | null;
  intolerance?: Intolerance | null;
  healthGoal?: HealthGoal | null;
  severity: RestrictionSeverity;
  notes?: string | null;
  appliesToHomeId?: string | null;
}

export interface DietaryProfileData {
  id: string;
  userId: string;
  restrictions: DietaryRestriction[];
  preferredCuisines: string[];
  dislikedIngredients: string[];
  favoriteIngredients: string[];
  calorieTarget?: number | null;
  proteinTarget?: number | null;
  carbsTarget?: number | null;
  fatTarget?: number | null;
  mealsPerDay: number;
  snacksPerDay: number;
  cookingSkillLevel?: string | null;
  maxPrepTimeMinutes?: number | null;
  maxCookTimeMinutes?: number | null;
  budgetPerMeal?: number | null;
}

export const useDietaryProfile = () => {
  const user = useStore(state => state.user);
  const {data, loading, refetch} = useGetDietaryProfileQuery({
    skip: !user?.id,
  });
  const [updateProfile] = useUpdateDietaryProfileMutation();
  const [addRestriction] = useAddDietaryRestrictionMutation();
  const [updateRestriction] = useUpdateDietaryRestrictionMutation();
  const [removeRestriction] = useRemoveDietaryRestrictionMutation();

  const profile = data?.myDietaryProfile;

  const getDietaryProfile = useCallback((): DietaryProfileData | null => {
    if (!profile) return null;

    return {
      id: profile.id,
      userId: profile.userId,
      restrictions: profile.restrictions?.map(r => ({
        id: r.id,
        diet: r.diet,
        intolerance: r.intolerance,
        healthGoal: r.healthGoal,
        severity: r.severity,
        notes: r.notes,
        appliesToHomeId: r.appliesToHomeId,
      })) || [],
      preferredCuisines: profile.preferredCuisines || [],
      dislikedIngredients: profile.dislikedIngredients || [],
      favoriteIngredients: profile.favoriteIngredients || [],
      calorieTarget: profile.calorieTarget,
      proteinTarget: profile.proteinTarget,
      carbsTarget: profile.carbsTarget,
      fatTarget: profile.fatTarget,
      mealsPerDay: profile.mealsPerDay || 3,
      snacksPerDay: profile.snacksPerDay || 1,
      cookingSkillLevel: profile.cookingSkillLevel,
      maxPrepTimeMinutes: profile.maxPrepTimeMinutes,
      maxCookTimeMinutes: profile.maxCookTimeMinutes,
      budgetPerMeal: profile.budgetPerMeal,
    };
  }, [profile]);

  const updateDietaryProfile = useCallback(
    async (updates: {
      preferredCuisines?: string[];
      dislikedIngredients?: string[];
      favoriteIngredients?: string[];
      calorieTarget?: number | null;
      proteinTarget?: number | null;
      carbsTarget?: number | null;
      fatTarget?: number | null;
      mealsPerDay?: number;
      snacksPerDay?: number;
      cookingSkillLevel?: string | null;
      maxPrepTimeMinutes?: number | null;
      maxCookTimeMinutes?: number | null;
      budgetPerMeal?: number | null;
    }) => {
      try {
        // Convert null to undefined for GraphQL input
        const cleanedUpdates = Object.fromEntries(
          Object.entries(updates).map(([key, value]) => [
            key,
            value === null ? undefined : value,
          ])
        );

        await updateProfile({
          variables: {
            input: cleanedUpdates,
          },
        });

        await refetch();
        return true;
      } catch (error) {
        console.error('Failed to update dietary profile:', error);
        return false;
      }
    },
    [updateProfile, refetch],
  );

  const addDietaryRestriction = useCallback(
    async (
      restriction: {
        diet?: Diet;
        intolerance?: Intolerance;
        healthGoal?: HealthGoal;
      },
      severity: RestrictionSeverity,
      notes?: string,
      appliesToHomeId?: string,
    ) => {
      try {
        await addRestriction({
          variables: {
            input: {
              ...restriction,
              severity,
              notes,
              appliesToHomeId,
            },
          },
        });

        await refetch();
        return true;
      } catch (error) {
        console.error('Failed to add dietary restriction:', error);
        return false;
      }
    },
    [addRestriction, refetch],
  );

  const updateDietaryRestriction = useCallback(
    async (
      id: string,
      updates: {
        severity?: RestrictionSeverity;
        notes?: string;
      },
    ) => {
      try {
        await updateRestriction({
          variables: {
            input: {
              id,
              ...updates,
            },
          },
        });

        await refetch();
        return true;
      } catch (error) {
        console.error('Failed to update dietary restriction:', error);
        return false;
      }
    },
    [updateRestriction, refetch],
  );

  const removeDietaryRestriction = useCallback(
    async (id: string) => {
      try {
        await removeRestriction({
          variables: {
            input: {
              id,
            },
          },
        });

        await refetch();
        return true;
      } catch (error) {
        console.error('Failed to remove dietary restriction:', error);
        return false;
      }
    },
    [removeRestriction, refetch],
  );

  return {
    profile: getDietaryProfile(),
    loading,
    updateDietaryProfile,
    addDietaryRestriction,
    updateDietaryRestriction,
    removeDietaryRestriction,
    refetch,
  };
};
