import { useRef } from 'react';
import { useUser } from '#store/useAppStore';
import {
  heldFetchPolicy,
  type StandDownOptions,
} from '#/hooks/apollo/standDownOptions';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import {
  skipToken,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import type { Reference } from '@apollo/client';
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
  RestrictionKindInput,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { settleMutation } from '#/apollo/utils/settleMutation';
import type { RemoveRestrictionInputs } from '#features/profile/offline/localWrites';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';

export interface DietaryRestriction {
  id: string;
  diet?: Diet | null;
  intolerance?: Intolerance | null;
  healthGoal?: HealthGoal | null;
  /** The avoided catalog item, as the root the server stored. */
  item?: { id: string; name: string } | null;
  severity: RestrictionSeverity;
  notes?: string | null;
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
  /** How many people the user cooks for; null when not answered. */
  cooksFor?: number | null;
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
export const useDietaryProfile = ({
  fetchPolicy,
}: Pick<StandDownOptions, 'fetchPolicy'> = {}) => {
  const { t } = useTranslation();
  const user = useUser();

  // Each mount of the default asks the network once; a screen that only reads
  // the profile passes `cache-first`, which the profile's writes keep current.
  const { data, loading } = useQuery(
    GetDietaryProfileDocument,
    user?.id
      ? { errorPolicy: 'ignore', ...heldFetchPolicy(fetchPolicy) }
      : skipToken,
  );

  // Preserve last successful data when errorPolicy: 'ignore' returns undefined on error
  const profileKey = user?.id ?? '';
  const profile = usePreservedQueryData(
    data?.me?.dietaryProfile,
    null,
    profileKey,
  );
  const hasLoadedProfile = usePreservedQueryData(
    data?.me ? true : undefined,
    false,
    profileKey,
  );

  // A profile row is created by the first write, never by a read.
  const pendingCreation = useRef<Promise<boolean> | null>(null);

  const client = useApolloClient();

  // ===== MUTATION 1: Update Dietary Profile =====
  const [updateProfile] = useMutation(UpdateDietaryProfileDocument, {
    context: { localFirst: true },
  });

  // ===== MUTATION 2: Add Dietary Restriction =====
  const [addRestriction] = useMutation(AddDietaryRestrictionDocument, {
    context: { localFirst: true },
    // Shown on the answer: the input takes no id, so a row shown before it
    // could not be removed while the add is queued.
    update: (cache, { data }) => {
      const payload = appliedPayload(data);
      // Read from the cache, not the render: the add can follow the profile's
      // creation within one handler.
      const profileId = cache.readQuery({
        query: GetDietaryProfileDocument,
        optimistic: true,
      })?.me?.dietaryProfile?.id;
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
  const [removeRestriction] = useMutation(RemoveDietaryRestrictionDocument, {
    context: { localFirst: true },
  });

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
        item: r.item,
        severity: r.severity,
        notes: r.notes,
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
      cooksFor: profile.cooksFor,
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
    cooksFor?: number | null;
    cookingSkillLevel?: CookingSkillLevel | null;
    maxPrepTimeMinutes?: number | null;
    maxCookTimeMinutes?: number | null;
    budgetPerMeal?: number | null;
  }) => {
    // Convert null to undefined for GraphQL input
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).map(([key, value]) => [key, value ?? undefined]),
    );

    const settled = await sendFields(client.cache, {
      entity: profile
        ? { __typename: 'DietaryProfile', id: profile.id }
        : undefined,
      fields: cleanedUpdates,
      variables: { input: cleanedUpdates },
      mutate: updateProfile,
      settle: {
        document: UpdateDietaryProfileDocument,
        fallback: t('errors.codes.genericRetry'),
      },
    });
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
    restriction: RestrictionKindInput,
    severity: RestrictionSeverity,
    notes?: string,
  ) => {
    if (!(await ensureProfileExists())) return false;
    const settled = await settleMutation(
      () =>
        addRestriction({
          variables: {
            input: { kind: restriction, severity, notes },
          },
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
    const inputs: RemoveRestrictionInputs = { profileId: profile?.id };
    const settled = await pendingWritesOf(client.cache).send(
      RemoveDietaryRestrictionDocument,
      { input: { id } },
      write =>
        settleMutation(() => removeRestriction(write), {
          document: RemoveDietaryRestrictionDocument,
          fallback: t('dietary.removeRestrictionFailed'),
          removal: true,
          present: 'none',
        }),
      inputs,
    );
    return settled.status !== 'failed';
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
