import { useUser } from '#store/useAppStore';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import { useMutation, useQuery } from '@apollo/client/react';
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
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { handleMutationError } from '#/utils/errorHandlers';
import { errorService } from '#/services/errorService';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { useTranslation } from '#/i18n';

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
  const { t } = useTranslation();

  // Online-only: dietary preferences are configured at home, so they carry no
  // offline replay machinery — the affordance is gated on this instead.
  const isApiUnavailable = useIsApiUnavailable();

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
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    // Convert null to undefined for GraphQL input
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).map(([key, value]) => [
        key,
        value === null ? undefined : value,
      ]),
    );

    let result;
    try {
      result = await updateProfile({ variables: { input: cleanedUpdates } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Failed to update dietary profile',
      });
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
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await addRestriction({
        variables: {
          input: { ...restriction, severity, notes, appliesToHomeId },
        },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Failed to add dietary restriction',
      });
    }
    return result ? !!result.data : false;
  };

  const updateDietaryRestriction = async (
    id: string,
    updates: {
      severity?: RestrictionSeverity;
      notes?: string;
    },
  ) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await updateRestriction({
        variables: { input: { id, ...updates } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Failed to update dietary restriction',
      });
    }
    return result ? !!result.data : false;
  };

  const removeDietaryRestriction = async (id: string) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await removeRestriction({ variables: { input: { id } } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Failed to remove dietary restriction',
      });
    }
    return result ? !!result.data : false;
  };

  return {
    profile: getDietaryProfile(),
    loading,
    updateDietaryProfile,
    addDietaryRestriction,
    updateDietaryRestriction,
    removeDietaryRestriction,
    isApiUnavailable,
  };
};
