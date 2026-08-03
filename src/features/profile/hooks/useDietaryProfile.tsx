import { useUser } from '#store/useAppStore';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import type { Reference } from '@apollo/client';
import {
  GetDietaryProfileDocument,
  UpdateDietaryProfileDocument,
  AddDietaryRestrictionDocument,
  UpdateDietaryRestrictionDocument,
  RemoveDietaryRestrictionDocument,
} from '#operations/user/user.generated';
import {
  Cuisine,
  Diet,
  Intolerance,
  HealthGoal,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { optimisticFieldUpdate } from '#/apollo/utils/optimisticFieldUpdate';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { handleMutationError } from '#/utils/errorHandlers';

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
  // Server stores cuisines as the `Cuisine` enum and echoes back the enum-name
  // strings (the read type is [String!]!); the write input is [Cuisine!]. Typed
  // as Cuisine[] so callers can only ever send valid enum members.
  preferredCuisines: Cuisine[];
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

  // The cache-and-network → cache-first pair
  // means first mount fires once, subsequent mounts read cache only.
  const { data, loading } = useQuery(GetDietaryProfileDocument, {
    skip: !user?.id,
    errorPolicy: 'ignore',
  });

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error
  const profile = usePreservedQueryData(data?.me?.dietaryProfile, null);

  const client = useApolloClient();

  // ===== MUTATION 1: Update Dietary Profile =====
  // Local-first: the wrapper writes the changed fields to the cached
  // DietaryProfile PERMANENTLY before firing (an optimisticResponse would be
  // torn down on the offline queue's null result) and reverts on rejection.
  const [updateProfile] = useMutation(UpdateDietaryProfileDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Update Dietary Profile' });
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

      // Add the new restriction reference to DietaryProfile.restrictions
      cache.modify({
        id: cache.identify({ __typename: 'DietaryProfile', id: profile.id }),
        fields: {
          restrictions(
            existingRestrictions: readonly Reference[] = [],
            { toReference, readField },
          ) {
            const newRestrictionRef = toReference(newRestriction);

            // Check if restriction already exists (prevent duplicates)
            const exists = existingRestrictions.some(
              ref => readField('id', ref) === newRestriction.id,
            );

            if (exists || !newRestrictionRef) return existingRestrictions;

            // Add to end of array
            return [...existingRestrictions, newRestrictionRef];
          },
        },
      });
    },
    onError: error => {
      handleMutationError(error, { operation: 'Add Dietary Restriction' });
    },
  });

  // ===== MUTATION 3: Update Dietary Restriction =====
  // Local-first: the wrapper writes the changed restriction fields to cache
  // PERMANENTLY before firing and reverts on rejection.
  const [updateRestriction] = useMutation(UpdateDietaryRestrictionDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Update Dietary Restriction' });
    },
  });

  // ===== MUTATION 4: Remove Dietary Restriction =====
  const [removeRestriction] = useMutation(RemoveDietaryRestrictionDocument, {
    // No optimistic response for deletes — the cache removal runs on the response
    update: (cache, { data }, { variables }) => {
      if (
        data?.removeRestriction?.__typename !== 'RemoveRestrictionPayload' ||
        !variables?.input?.id ||
        !profile?.id
      )
        return;

      const restrictionId = variables.input.id;

      // Step 1: Remove the restriction reference from DietaryProfile.restrictions
      cache.modify({
        id: cache.identify({ __typename: 'DietaryProfile', id: profile.id }),
        fields: {
          restrictions(
            existingRestrictions: readonly Reference[] = [],
            { readField },
          ) {
            return existingRestrictions.filter(
              ref => readField('id', ref) !== restrictionId,
            );
          },
        },
      });

      // Step 2: Evict the entity and garbage collect
      safeEvict(cache, 'DietaryRestriction', restrictionId);
    },
    onError: error => {
      handleMutationError(error, { operation: 'Remove Dietary Restriction' });
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
      preferredCuisines: (profile.preferredCuisines ?? []) as Cuisine[],
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
    preferredCuisines?: Cuisine[];
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

    // Permanent optimistic write of the changed (flat) fields + snapshot revert.
    const cacheId = profile
      ? client.cache.identify({ __typename: 'DietaryProfile', id: profile.id })
      : undefined;
    const { revert } = optimisticFieldUpdate(
      client.cache,
      cacheId,
      profile,
      cleanedUpdates,
      'Update Dietary Profile',
    );

    const result = await executeMutation(
      () =>
        updateProfile({
          variables: { input: cleanedUpdates },
          context: { localFirst: true },
        }),
      'Failed to update dietary profile',
    );
    if (classifyCreateResult(result) === 'rejected') {
      revert();
    }
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
          // No optimisticResponse to tear down — queue offline and replay
          // idempotently; the cache update runs on the (replayed) response.
          context: { localFirst: true },
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
    // Permanent optimistic write of the changed restriction fields + revert.
    const cacheId = client.cache.identify({
      __typename: 'DietaryRestriction',
      id,
    });
    const currentRestriction = profile?.restrictions?.find(r => r.id === id);
    const { revert } = optimisticFieldUpdate(
      client.cache,
      cacheId,
      currentRestriction,
      updates,
      'Update Dietary Restriction',
    );

    const result = await executeMutation(
      () =>
        updateRestriction({
          variables: { input: { id, ...updates } },
          context: { localFirst: true },
        }),
      'Failed to update dietary restriction',
    );
    if (classifyCreateResult(result) === 'rejected') {
      revert();
    }
    return result ? !!result.data : false;
  };

  const removeDietaryRestriction = async (id: string) => {
    const result = await executeMutation(
      () =>
        removeRestriction({
          variables: { input: { id } },
          // No optimisticResponse to tear down — queue offline and replay
          // idempotently; the cache removal runs on the (replayed) response.
          context: { localFirst: true },
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
