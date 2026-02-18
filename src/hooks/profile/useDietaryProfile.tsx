import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useStore } from '#store';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
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
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { useErrorHandler } from '#/utils/errorHandling';

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
  const { handleApolloError } = useErrorHandler();

  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-first: Uses cache if available for profile data
  // - errorPolicy: 'ignore' returns cached data when network fails

  const { data, loading, networkStatus } = useGetDietaryProfileQuery({
    skip: !user?.id,
    fetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
    notifyOnNetworkStatusChange: true,
  });

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error
  const profile = usePreservedQueryData(data?.myDietaryProfile, null);

  // ===== MUTATION 1: Update Dietary Profile =====
  const [updateProfile] = useUpdateDietaryProfileMutation({
    errorPolicy: 'all',
    // Uses automatic normalization - mutation returns full DietaryProfile fragment
    // No manual cache update needed (Pattern 2)
    optimisticResponse: (variables, { IGNORE }) => {
      if (!profile) return IGNORE;

      return {
        __typename: 'Mutation',
        updateDietaryProfile: {
          __typename: 'DietaryProfilePayload',
          success: true,
          message: 'Dietary profile updated',
          code: 'DIETARY_PROFILE_UPDATED',
          dietaryProfile: enhanceWithVersion(
            profile as any,
            variables.input,
          ),
        },
      };
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Dietary Profile',
      });
      Alert.alert('Error', message);
    },
  });

  // ===== MUTATION 2: Add Dietary Restriction =====
  const [addRestriction] = useAddDietaryRestrictionMutation({
    errorPolicy: 'all',
    // Note: No optimistic response - DietaryRestriction has complex enum types that need server validation
    // cache.modify() handles instant UI update when server responds (~100-200ms)
    update: (cache, { data }) => {
      if (!data?.addRestriction?.dietaryRestriction || !profile?.id) return;

      const newRestriction = data.addRestriction.dietaryRestriction;

      // Add restriction to DietaryProfile.restrictions array (Pattern 1)
      cache.modify({
        id: cache.identify({ __typename: 'DietaryProfile', id: profile.id }),
        fields: {
          restrictions(existingRestrictions = [], { toReference, readField }) {
            const newRestrictionRef = toReference(newRestriction);

            // Check if restriction already exists (prevent duplicates)
            const exists = existingRestrictions.some(
              (ref: any) => readField('id', ref) === newRestriction.id,
            );

            if (exists) return existingRestrictions;

            // Add to end of array
            return [...existingRestrictions, newRestrictionRef];
          },
        },
      });
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Add Dietary Restriction',
      });
      Alert.alert('Error', message);
    },
  });

  // ===== MUTATION 3: Update Dietary Restriction =====
  const [updateRestriction] = useUpdateDietaryRestrictionMutation({
    errorPolicy: 'all',
    // Uses automatic normalization - mutation returns full DietaryRestriction fragment
    // No manual cache update needed (Pattern 2)
    optimisticResponse: (variables, { IGNORE }) => {
      const currentRestriction = profile?.restrictions?.find(
        r => r.id === variables.input.id,
      );
      if (!currentRestriction) return IGNORE;

      return {
        __typename: 'Mutation',
        updateRestriction: {
          __typename: 'DietaryRestrictionPayload',
          success: true,
          message: 'Dietary restriction updated',
          code: 'DIETARY_RESTRICTION_UPDATED',
          dietaryRestriction: enhanceWithVersion(
            currentRestriction as any,
            variables.input,
          ),
        },
      };
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Dietary Restriction',
      });
      Alert.alert('Error', message);
    },
  });

  // ===== MUTATION 4: Remove Dietary Restriction =====
  const [removeRestriction] = useRemoveDietaryRestrictionMutation({
    errorPolicy: 'all',
    // No optimistic response for deletes (following Pattern 4 recommendation)
    update: (cache, { data }, { variables }) => {
      if (!data?.removeRestriction?.success || !variables?.input?.id || !profile?.id)
        return;

      const restrictionId = variables.input.id;

      // Step 1: Remove from DietaryProfile.restrictions array (Pattern 4)
      cache.modify({
        id: cache.identify({ __typename: 'DietaryProfile', id: profile.id }),
        fields: {
          restrictions(existingRestrictions = [], { readField }) {
            return existingRestrictions.filter(
              (ref: any) => readField('id', ref) !== restrictionId,
            );
          },
        },
      });

      // Step 2: Evict the entity from cache
      cache.evict({
        id: cache.identify({
          __typename: 'DietaryRestriction',
          id: restrictionId,
        }),
      });

      // Step 3: CRITICAL - Garbage collect orphaned data
      cache.gc();
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Dietary Restriction',
      });
      Alert.alert('Error', message);
    },
  });

  const getDietaryProfile = useCallback((): DietaryProfileData | null => {
    if (!profile) return null;

    return {
      id: profile.id,
      userId: profile.userId,
      restrictions:
        profile.restrictions?.map(r => ({
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
          ]),
        );

        const result = await updateProfile({
          variables: {
            input: cleanedUpdates,
          },
        });

        // No refetch needed - automatic normalization + optimistic response handle UI updates
        return !!result.data;
      } catch {
        // Error handled by onError handler
        return false;
      }
    },
    [updateProfile],
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
        const result = await addRestriction({
          variables: {
            input: {
              ...restriction,
              severity,
              notes,
              appliesToHomeId,
            },
          },
        });

        // No refetch needed - cache.modify() + optimistic response handle UI updates
        return !!result.data;
      } catch {
        // Error handled by onError handler
        return false;
      }
    },
    [addRestriction],
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
        const result = await updateRestriction({
          variables: {
            input: {
              id,
              ...updates,
            },
          },
        });

        // No refetch needed - automatic normalization + optimistic response handle UI updates
        return !!result.data;
      } catch {
        // Error handled by onError handler
        return false;
      }
    },
    [updateRestriction],
  );

  const removeDietaryRestriction = useCallback(
    async (id: string) => {
      try {
        const result = await removeRestriction({
          variables: {
            input: {
              id,
            },
          },
        });

        // No refetch needed - cache.modify() + cache.evict() + cache.gc() handle UI updates
        return !!result.data;
      } catch {
        // Error handled by onError handler
        return false;
      }
    },
    [removeRestriction],
  );

  return {
    profile: getDietaryProfile(),
    loading,
    networkStatus,
    updateDietaryProfile,
    addDietaryRestriction,
    updateDietaryRestriction,
    removeDietaryRestriction,
  };
};
