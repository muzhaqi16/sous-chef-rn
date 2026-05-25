import { alertService } from '#/services/alertService';
import { useUser } from '#store/useAppStore';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  GetDietaryProfileDocument,
  UpdateDietaryProfileDocument,
  AddDietaryRestrictionDocument,
  UpdateDietaryRestrictionDocument,
  RemoveDietaryRestrictionDocument,
  type UpdateDietaryProfileMutation,
  type UpdateDietaryRestrictionMutation,
} from '#operations/user/user.generated';
import {
  Diet,
  Intolerance,
  HealthGoal,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { enhanceWithVersion } from '#/apollo/utils/createOptimisticResponse';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { useErrorService } from '#/services/errorService';

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
  const user = useUser();
  const { handleApolloError } = useErrorService();

  // The cache-and-network → cache-first pair
  // means first mount fires once, subsequent mounts read cache only.
  const { data, loading } = useQuery(GetDietaryProfileDocument, {
    skip: !user?.id,
    errorPolicy: 'ignore',
  });

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error
  const profile = usePreservedQueryData(data?.me?.dietaryProfile, null);

  // ===== MUTATION 1: Update Dietary Profile =====
  const [updateProfile] = useMutation(UpdateDietaryProfileDocument, {
    // Uses automatic normalization - mutation returns full DietaryProfile fragment
    // No manual cache update needed (Pattern 2)
    optimisticResponse: (variables, { IGNORE }) => {
      if (!profile) return IGNORE;
      const optimistic: UpdateDietaryProfileMutation = {
        __typename: 'Mutation',
        updateDietaryProfile: {
          __typename: 'UpdateDietaryProfilePayload',
          dietaryProfile: enhanceWithVersion(profile, variables.input),
        },
      };
      return optimistic;
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Dietary Profile',
      });
      alertService.alert('Error', message);
    },
  });

  // ===== MUTATION 2: Add Dietary Restriction =====
  const [addRestriction] = useMutation(AddDietaryRestrictionDocument, {
    // Note: No optimistic response - DietaryRestriction has complex enum types that need server validation
    // cache.modify() handles instant UI update when server responds (~100-200ms)
    update: (cache, { data }) => {
      if (
        data?.addRestriction?.__typename !== 'AddRestrictionPayload' ||
        !profile?.id
      )
        return;

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
      alertService.alert('Error', message);
    },
  });

  // ===== MUTATION 3: Update Dietary Restriction =====
  const [updateRestriction] = useMutation(UpdateDietaryRestrictionDocument, {
    // Uses automatic normalization - mutation returns full DietaryRestriction fragment
    // No manual cache update needed (Pattern 2)
    optimisticResponse: (variables, { IGNORE }) => {
      const currentRestriction = profile?.restrictions?.find(
        r => r.id === variables.input.id,
      );
      if (!currentRestriction) return IGNORE;
      const optimistic: UpdateDietaryRestrictionMutation = {
        __typename: 'Mutation',
        updateRestriction: {
          __typename: 'UpdateRestrictionPayload',
          dietaryRestriction: enhanceWithVersion(
            currentRestriction,
            variables.input,
          ),
        },
      };
      return optimistic;
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Dietary Restriction',
      });
      alertService.alert('Error', message);
    },
  });

  // ===== MUTATION 4: Remove Dietary Restriction =====
  const [removeRestriction] = useMutation(RemoveDietaryRestrictionDocument, {
    // No optimistic response for deletes (following Pattern 4 recommendation)
    update: (cache, { data }, { variables }) => {
      if (
        data?.removeRestriction?.__typename !== 'RemoveRestrictionPayload' ||
        !variables?.input?.id ||
        !profile?.id
      )
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

      // Step 2: Evict the entity and garbage collect
      safeEvict(cache, 'DietaryRestriction', restrictionId);
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Dietary Restriction',
      });
      alertService.alert('Error', message);
    },
  });

  const getDietaryProfile = (): DietaryProfileData | null => {
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
  };

  const updateDietaryProfile = async (updates: {
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
    // Convert null to undefined for GraphQL input
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).map(([key, value]) => [
        key,
        value === null ? undefined : value,
      ]),
    );

    const result = await executeMutation(
      () => updateProfile({ variables: { input: cleanedUpdates } }),
      'Failed to update dietary profile',
    );
    return result ? !!result.data : false;
  };

  const addDietaryRestriction = async (
    restriction: {
      diet?: Diet;
      intolerance?: Intolerance;
      healthGoal?: HealthGoal;
    },
    severity: RestrictionSeverity,
    notes?: string,
    appliesToHomeId?: string,
  ) => {
    const result = await executeMutation(
      () =>
        addRestriction({
          variables: {
            input: { ...restriction, severity, notes, appliesToHomeId },
          },
        }),
      'Failed to add dietary restriction',
    );
    return result ? !!result.data : false;
  };

  const updateDietaryRestriction = async (
    id: string,
    updates: {
      severity?: RestrictionSeverity;
      notes?: string;
    },
  ) => {
    const result = await executeMutation(
      () =>
        updateRestriction({
          variables: { input: { id, ...updates } },
        }),
      'Failed to update dietary restriction',
    );
    return result ? !!result.data : false;
  };

  const removeDietaryRestriction = async (id: string) => {
    const result = await executeMutation(
      () =>
        removeRestriction({
          variables: { input: { id } },
        }),
      'Failed to remove dietary restriction',
    );
    return result ? !!result.data : false;
  };

  return {
    profile: getDietaryProfile(),
    loading,
    updateDietaryProfile,
    addDietaryRestriction,
    updateDietaryRestriction,
    removeDietaryRestriction,
  };
};
