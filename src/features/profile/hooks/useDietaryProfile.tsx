import { useRef } from 'react';
import { useUser } from '#store/useAppStore';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import type { ApolloCache, Reference } from '@apollo/client';
import {
  GetDietaryProfileDocument,
  UpdateDietaryProfileDocument,
  AddDietaryRestrictionDocument,
  RemoveDietaryRestrictionDocument,
} from '#operations/user/user.generated';
import type {
  CookingSkillLevel,
  Cuisine,
  Diet,
  Intolerance,
  HealthGoal,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { optimisticFieldUpdate } from '#/apollo/utils/optimisticFieldUpdate';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
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
  cookingSkillLevel?: CookingSkillLevel | null;
  maxPrepTimeMinutes?: number | null;
  maxCookTimeMinutes?: number | null;
  budgetPerMeal?: number | null;
}

export type DietaryProfileValues = Omit<DietaryProfileData, 'id' | 'userId'>;

/** What the server creates a profile with (`DietaryProfileRepository`). */
const DIETARY_PROFILE_DEFAULTS: DietaryProfileValues = {
  restrictions: [],
  preferredCuisines: [],
  dislikedIngredients: [],
  favoriteIngredients: [],
  mealsPerDay: 3,
  snacksPerDay: 1,
  maxPrepTimeMinutes: 45,
  maxCookTimeMinutes: 60,
};

/**
 * Every write resolves to `true` once it landed or is queued and `false` when
 * it failed. A failure is alerted here, except a removal: its screen names it.
 */
export const useDietaryProfile = () => {
  const { t } = useTranslation();
  const user = useUser();

  // The cache-and-network → cache-first pair
  // means first mount fires once, subsequent mounts read cache only.
  const { data, loading } = useQuery(GetDietaryProfileDocument, {
    skip: !user?.id,
    errorPolicy: 'ignore',
  });

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error
  const profile = usePreservedQueryData(data?.me?.dietaryProfile, null);
  const hasLoadedProfile = usePreservedQueryData(
    data?.me ? true : undefined,
    false,
  );

  // A profile row is created by the first write, never by a read.
  const pendingCreation = useRef<Promise<boolean> | null>(null);

  const client = useApolloClient();

  // ===== MUTATION 1: Update Dietary Profile =====
  // Local-first: the changed fields are written to the cached DietaryProfile
  // PERMANENTLY before firing (an optimisticResponse would be torn down on the
  // offline queue's null result) and reverted on failure.
  const [updateProfile] = useMutation(UpdateDietaryProfileDocument);

  // ===== MUTATION 2: Add Dietary Restriction =====
  const [addRestriction] = useMutation(AddDietaryRestrictionDocument, {
    // Note: No optimistic response - DietaryRestriction has complex enum types that need server validation
    // cache.modify() handles instant UI update when server responds (~100-200ms)
    update: (cache, { data }) => {
      const payload = appliedPayload(data);
      // Read from the cache, not the render: the add can follow the profile's
      // creation within one handler.
      const profileId = cache.readQuery({ query: GetDietaryProfileDocument })
        ?.me?.dietaryProfile?.id;
      if (!payload || !profileId) return;

      const newRestriction = payload.dietaryRestriction;

      // Add the new restriction reference to DietaryProfile.restrictions
      cache.modify({
        id: cache.identify({ __typename: 'DietaryProfile', id: profileId }),
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
  });

  // ===== MUTATION 3: Remove Dietary Restriction =====
  // The cache removal runs after the settle, for every outcome but a failure.
  const [removeRestriction] = useMutation(RemoveDietaryRestrictionDocument);

  const getDietaryProfile = (): DietaryProfileData | null => {
    if (!profile) return null;

    return {
      id: profile.id,
      userId: profile.userId,
      restrictions: profile.restrictions.map(r => ({
        id: r.id,
        diet: r.diet,
        intolerance: r.intolerance,
        healthGoal: r.healthGoal,
        severity: r.severity,
        notes: r.notes,
        appliesToHomeId: r.appliesToHomeId,
      })),
      preferredCuisines: profile.preferredCuisines,
      dislikedIngredients: profile.dislikedIngredients,
      favoriteIngredients: profile.favoriteIngredients,
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
    cookingSkillLevel?: CookingSkillLevel | null;
    maxPrepTimeMinutes?: number | null;
    maxCookTimeMinutes?: number | null;
    budgetPerMeal?: number | null;
  }) => {
    // Convert null to undefined for GraphQL input
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).map(([key, value]) => [key, value ?? undefined]),
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

    const settled = await settleMutation(
      () =>
        updateProfile({
          variables: { input: cleanedUpdates },
          context: { localFirst: true },
        }),
      {
        document: UpdateDietaryProfileDocument,
        fallback: t('errors.codes.genericRetry'),
        onFailed: revert,
      },
    );
    return settled.status !== 'failed';
  };

  // Restrictions are added in parallel, and the server creates a missing
  // profile per add — concurrent creates collide on the unique `userId`.
  const ensureProfileExists = (): Promise<boolean> => {
    if (profile) return Promise.resolve(true);
    const pending = pendingCreation.current;
    if (pending) return pending;
    const creation = updateDietaryProfile({}).then(created => {
      if (!created) pendingCreation.current = null;
      return created;
    });
    pendingCreation.current = creation;
    return creation;
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
    if (!(await ensureProfileExists())) return false;
    const settled = await settleMutation(
      () =>
        addRestriction({
          variables: {
            input: { ...restriction, severity, notes, appliesToHomeId },
          },
          // No optimisticResponse to tear down — queue offline and replay
          // idempotently; the cache update runs on the (replayed) response.
          context: { localFirst: true },
        }),
      {
        document: AddDietaryRestrictionDocument,
        fallback: t('errors.codes.genericRetry'),
        // Both callers alert on the false return; a second alert stacks, and
        // a bulk add stacks one per restriction.
        present: 'none',
      },
    );
    return settled.status !== 'failed';
  };

  const removeDietaryRestriction = async (id: string) => {
    const settled = await settleMutation(
      () =>
        removeRestriction({
          variables: { input: { id } },
          // No optimisticResponse to tear down — queue offline and replay
          // idempotently; the cache removal runs on the (replayed) response.
          context: { localFirst: true },
        }),
      {
        document: RemoveDietaryRestrictionDocument,
        fallback: t('dietary.removeRestrictionFailed'),
        removal: true,
        present: 'none',
      },
    );
    if (settled.status === 'failed') return false;
    // Applied, queued, or already gone — a top-level gone code included, which
    // carries no payload an `update` could read.
    if (profile) removeRestrictionFromCache(client.cache, profile.id, id);
    return true;
  };

  const dietaryProfile = getDietaryProfile();

  return {
    profile: dietaryProfile,
    // What an editor shows: the server's defaults until the first write
    // creates the row. `null` only while nothing has been read.
    editableProfile:
      dietaryProfile ?? (hasLoadedProfile ? DIETARY_PROFILE_DEFAULTS : null),
    loading,
    updateDietaryProfile,
    addDietaryRestriction,
    removeDietaryRestriction,
  };
};

/** Takes a removed restriction off its profile and out of the cache. */
function removeRestrictionFromCache(
  cache: ApolloCache,
  profileId: string,
  restrictionId: string,
): void {
  cache.modify({
    id: cache.identify({ __typename: 'DietaryProfile', id: profileId }),
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
  safeEvict(cache, 'DietaryRestriction', restrictionId);
}
