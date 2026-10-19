import { useEffect } from 'react';
import { useUser } from '#store/useAppStore';
import {
  skipToken,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import {
  GetNotificationPreferencesDocument,
  UpdateNotificationPreferencesDocument,
} from '#operations/user/user.generated';
import {
  ExpirationFrequency,
  type UpdateNotificationPreferencesInput,
} from '#/graphql/generated/schemaTypes';
import type { ApolloCache } from '@apollo/client';
import { settleMutation } from '#/apollo/utils/settleMutation';
import {
  snapshotFields,
  type FieldsEntityRef,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { computeIsQuietTime } from '#features/notifications/utils/quietHours';
import { logger } from '#/utils/environment';
import { t } from '#/i18n';

export interface NotificationSettings {
  // Core toggles
  emailEnabled: boolean;
  pushEnabled: boolean;

  // Pantry notifications
  expirationNotifications: boolean;
  expirationNotificationFrequency: ExpirationFrequency;
  expirationDaysThreshold: number;
  lowStockAlerts: boolean;
  pantryChanges: boolean;

  // Shopping list and collaboration
  shoppingListUpdates: boolean;
  collaborationInvites: boolean;
  homeInvites: boolean;
  sharedListUpdates: boolean;

  // Recipe and meal planning
  recipeRecommendations: boolean;
  mealPlanReminders: boolean;
  cookingReminders: boolean;

  // Digests and reports
  weeklyDigest: boolean;
  monthlyReport: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string | null;
}

type PreferencesInput = UpdateNotificationPreferencesInput;
type ChannelsInput = NonNullable<PreferencesInput['channels']>;
type ExpirationInput = NonNullable<PreferencesInput['expiration']>;
type FeaturesInput = NonNullable<PreferencesInput['features']>;
type QuietHoursInput = NonNullable<PreferencesInput['quietHours']>;

type FlatPreferencesInput = ChannelsInput &
  ExpirationInput &
  FeaturesInput &
  QuietHoursInput;
type FlatPreferenceKey = keyof FlatPreferencesInput;

/** The table must name every key of `T`, so a schema key no bucket lists fails to compile. */
function keysOf<T extends object>(table: {
  [K in keyof T]-?: true;
}): (keyof T)[] {
  const keys: (keyof T)[] = [];
  for (const key in table) keys.push(key);
  return keys;
}

const CHANNELS_KEYS = keysOf<ChannelsInput>({
  emailEnabled: true,
  pushEnabled: true,
});

const EXPIRATION_KEYS = keysOf<ExpirationInput>({
  expirationNotifications: true,
  expirationNotificationFrequency: true,
  expirationDaysThreshold: true,
});

const FEATURES_KEYS = keysOf<FeaturesInput>({
  lowStockAlerts: true,
  pantryChanges: true,
  shoppingListUpdates: true,
  collaborationInvites: true,
  homeInvites: true,
  sharedListUpdates: true,
  recipeRecommendations: true,
  mealPlanReminders: true,
  cookingReminders: true,
  weeklyDigest: true,
  monthlyReport: true,
});

const QUIET_HOURS_KEYS = keysOf<QuietHoursInput>({
  quietHoursEnabled: true,
  quietHoursStart: true,
  quietHoursEnd: true,
  quietHoursTimezone: true,
});

/** The keys of `flat` in `keys`, a null sent as omitted; `undefined` when none is present. */
function pickBucket<K extends FlatPreferenceKey>(
  flat: FlatPreferencesInput,
  keys: readonly K[],
): Partial<Pick<FlatPreferencesInput, K>> | undefined {
  const bucket: Partial<Pick<FlatPreferencesInput, K>> = {};
  let present = false;
  for (const key of keys) {
    if (!(key in flat)) continue;
    bucket[key] = flat[key] ?? undefined;
    present = true;
  }
  return present ? bucket : undefined;
}

/** A settings key with no home in the input schema makes the call site fail to compile. */
function toNestedInput(
  flat: FlatPreferencesInput & {
    [K in Exclude<keyof NotificationSettings, FlatPreferenceKey>]?: never;
  },
): UpdateNotificationPreferencesInput {
  const input: UpdateNotificationPreferencesInput = {};
  const channels = pickBucket(flat, CHANNELS_KEYS);
  if (channels) input.channels = channels;
  const expiration = pickBucket(flat, EXPIRATION_KEYS);
  if (expiration) input.expiration = expiration;
  const features = pickBucket(flat, FEATURES_KEYS);
  if (features) input.features = features;
  const quietHours = pickBucket(flat, QUIET_HOURS_KEYS);
  if (quietHours) input.quietHours = quietHours;
  return input;
}

/**
 * Cache first, fire with `localFirst`, revert only on a genuine refusal. Module
 * scope so the timezone effect's dependency never re-arms it. True when the
 * change counts as saved (queued included).
 */
export async function applySettingsUpdate({
  cache,
  entity,
  updates,
  previous,
  mutate,
}: {
  cache: ApolloCache;
  entity: FieldsEntityRef | undefined;
  updates: Partial<NotificationSettings>;
  previous: Partial<NotificationSettings>;
  mutate: (
    input: UpdateNotificationPreferencesInput,
  ) => Promise<{ data?: unknown; error?: unknown }>;
}): Promise<boolean> {
  return updateEntityFieldsLocalFirst<NotificationSettings>({
    cache,
    entity,
    updates,
    previous,
    // localFirst: an unreachable API queues the change for replay rather
    // than failing it, so the toggle the user just flipped isn't lost.
    settle: () =>
      settleMutation(() => mutate(toNestedInput(updates)), {
        document: UpdateNotificationPreferencesDocument,
        fallback: t('notifications.updateFailed'),
        // The screen alerts off the returned boolean; the timezone sync logs.
        present: 'none',
      }),
  });
}

export const useNotificationSettings = (options?: { skip?: boolean }) => {
  const user = useUser();
  const client = useApolloClient();

  // The app-wide cache-and-network, never cache-first: a cache lacking
  // `me.notificationPreferences` must still reach the network to repair itself.
  const skipped = !user?.id || !!options?.skip;
  const { data, loading, error, refetch } = useQuery(
    GetNotificationPreferencesDocument,
    skipped ? skipToken : {},
  );

  const preferences = data?.me?.notificationPreferences;

  useApolloErrorLogger(GetNotificationPreferencesDocument, error);

  // `User.notificationPreferences` is NULL until a first change, when the
  // defaults below are right; only a read with no `me` leaves the screen unsure.
  const readUser = data?.me;
  useEffect(() => {
    if (!loading && !skipped && !readUser) {
      logger.warn(
        'Notification preferences could not be read — settings screen is showing defaults.',
        { hasError: !!error },
      );
    }
  }, [loading, readUser, skipped, error]);

  // No `optimisticResponse`: callers write permanently before firing, and an
  // optimistic layer is torn down on completion, which offline is `queueLink`'s
  // null result, snapping every toggle back.
  const [updatePreferences] = useMutation(
    UpdateNotificationPreferencesDocument,
    { context: { localFirst: true } },
  );

  // PERFORMANCE: Memoize settings object to prevent recreating on every render
  const settings = (() => {
    return {
      // Core toggles
      emailEnabled: preferences?.emailEnabled ?? true,
      pushEnabled: preferences?.pushEnabled ?? false,

      // Pantry notifications
      expirationNotifications: preferences?.expirationNotifications ?? true,
      expirationNotificationFrequency:
        preferences?.expirationNotificationFrequency ??
        ExpirationFrequency.DailyMorning,
      expirationDaysThreshold: preferences?.expirationDaysThreshold ?? 3,
      lowStockAlerts: preferences?.lowStockAlerts ?? true,
      pantryChanges: preferences?.pantryChanges ?? true,

      // Shopping list and collaboration
      shoppingListUpdates: preferences?.shoppingListUpdates ?? true,
      collaborationInvites: preferences?.collaborationInvites ?? true,
      homeInvites: preferences?.homeInvites ?? true,
      sharedListUpdates: preferences?.sharedListUpdates ?? true,

      // Recipe and meal planning
      recipeRecommendations: preferences?.recipeRecommendations ?? true,
      mealPlanReminders: preferences?.mealPlanReminders ?? true,
      cookingReminders: preferences?.cookingReminders ?? true,

      // Digests and reports
      weeklyDigest: preferences?.weeklyDigest ?? false,
      monthlyReport: preferences?.monthlyReport ?? false,

      // Quiet hours
      quietHoursEnabled: preferences?.quietHoursEnabled ?? false,
      quietHoursStart: preferences?.quietHoursStart ?? '22:00',
      quietHoursEnd: preferences?.quietHoursEnd ?? '08:00',
      quietHoursTimezone: preferences?.quietHoursTimezone ?? null,
    };
  })();

  /** The cached entity carrying the settings fields, once the query has loaded. */
  const preferencesEntity = preferences?.id
    ? { __typename: 'NotificationPreferences', id: preferences.id }
    : undefined;

  const updateMultipleSettings = async (
    updates: Partial<NotificationSettings>,
  ) => {
    const previous = snapshotFields<NotificationSettings>(settings, updates);

    return applySettingsUpdate({
      cache: client.cache,
      entity: preferencesEntity,
      updates,
      previous,
      mutate: input =>
        updatePreferences({
          variables: { input },
        }),
    });
  };

  /** Single-key convenience over {@link updateMultipleSettings}. */
  const updateNotificationSetting = async (
    key: keyof NotificationSettings,
    value: boolean | string | number | ExpirationFrequency,
  ) =>
    updateMultipleSettings({
      [key]: value,
    });

  const resetToDefaults = async () => {
    // The API's defaults for a new account (`notificationPreferencesDefaults`).
    const defaultSettings: Partial<NotificationSettings> = {
      emailEnabled: false,
      pushEnabled: false,
      expirationNotifications: false,
      expirationNotificationFrequency: ExpirationFrequency.DailyMorning,
      expirationDaysThreshold: 3,
      lowStockAlerts: false,
      pantryChanges: false,
      shoppingListUpdates: false,
      collaborationInvites: true,
      homeInvites: true,
      sharedListUpdates: false,
      recipeRecommendations: false,
      mealPlanReminders: false,
      cookingReminders: false,
      weeklyDigest: false,
      monthlyReport: false,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };

    return updateMultipleSettings(defaultSettings);
  };

  // Evaluated in the user's configured IANA timezone (not the device's) so
  // client suppression matches the server's. See computeIsQuietTime.
  const isQuietTime = (): boolean => computeIsQuietTime(settings);

  return {
    settings,
    loading,
    // `settings` always has a value (fabricated defaults), so it cannot say
    // whether the server answered; gating on `loading` blanks the screen on
    // every mount, since Apollo reports it true on each one.
    hasPreferences: !!preferences,
    skipped,
    error,
    refetch,
    updateNotificationSetting,
    resetToDefaults,
    isQuietTime,
  };
};
