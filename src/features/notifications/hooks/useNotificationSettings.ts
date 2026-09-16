import { useEffect } from 'react';
import { useUser } from '#store/useAppStore';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
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
  smsEnabled: boolean;

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
  smsEnabled: true,
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
 * The shared write path: cache first, fire with `localFirst`, revert only on a
 * genuine refusal. Module scope so the quiet-hours timezone effect can reuse it
 * without a per-render dependency that would re-arm it every render. Returns
 * whether the change is safe to treat as saved (queued counts).
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
  const { persisted } =
    await updateEntityFieldsLocalFirst<NotificationSettings>({
      cache,
      entity,
      updates,
      previous,
      // localFirst: an unreachable API queues the change for replay rather
      // than failing it, so the toggle the user just flipped isn't lost.
      mutate: async () => {
        const settled = await settleMutation(
          () => mutate(toNestedInput(updates)),
          {
            document: UpdateNotificationPreferencesDocument,
            fallback: t('notifications.updateFailed'),
            // The screen alerts off the returned boolean; the timezone sync logs.
            present: 'none',
          },
        );
        // A failure travels as `error`, which is what makes the helper revert.
        return settled.failure
          ? { error: settled.failure }
          : { data: settled.data };
      },
      logLabel: 'Failed to update notification settings',
    });

  // Queued counts as persisted — it replays later.
  return persisted;
}

export const useNotificationSettings = (options?: { skip?: boolean }) => {
  const user = useUser();
  const client = useApolloClient();

  // cache-and-network (the app-wide default) paints from cache and still
  // refreshes on mount. Under cache-first this query never reached the network
  // once anything was cached, so a cache that lacked `me.notificationPreferences`
  // could never repair itself and `settings` stayed on the defaults below —
  // which reads as "every toggle is broken".
  const skipped = !user?.id || !!options?.skip;
  const { data, loading, error, refetch } = useQuery(
    GetNotificationPreferencesDocument,
    {
      skip: skipped,
      fetchPolicy: 'cache-and-network',
    },
  );

  const preferences = data?.me?.notificationPreferences;

  useApolloErrorLogger(GetNotificationPreferencesDocument, error);

  // `User.notificationPreferences` is NULLABLE: an account that has never
  // changed a setting has no row, and the defaults below are then the right
  // answer, not a lie. Only a read that produced no `me` at all leaves the
  // screen unable to know what it is showing.
  const readUser = data?.me;
  useEffect(() => {
    if (!loading && !skipped && !readUser) {
      logger.warn(
        'Notification preferences could not be read — settings screen is showing defaults.',
        { hasError: !!error },
      );
    }
  }, [loading, readUser, skipped, error]);

  // The mutation returns the full fragment, so normalization is the whole cache
  // update. No `optimisticResponse`: callers write permanently before firing,
  // and an optimistic layer is torn down on completion — offline that
  // completion is `queueLink`'s null result, which snaps every toggle back.
  const [updatePreferences] = useMutation(
    UpdateNotificationPreferencesDocument,
  );

  // PERFORMANCE: Memoize settings object to prevent recreating on every render
  const settings = (() => {
    return {
      // Core toggles
      emailEnabled: preferences?.emailEnabled ?? true,
      pushEnabled: preferences?.pushEnabled ?? false,
      smsEnabled: preferences?.smsEnabled ?? false,

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
          context: { localFirst: true },
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
    const defaultSettings: Partial<NotificationSettings> = {
      emailEnabled: true,
      pushEnabled: false,
      smsEnabled: false,
      expirationNotifications: true,
      expirationNotificationFrequency: ExpirationFrequency.DailyMorning,
      expirationDaysThreshold: 3,
      lowStockAlerts: true,
      pantryChanges: true,
      shoppingListUpdates: true,
      collaborationInvites: true,
      homeInvites: true,
      sharedListUpdates: true,
      recipeRecommendations: true,
      mealPlanReminders: true,
      cookingReminders: true,
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
    // `settings` always has a value — every field below falls back to a
    // fabricated default — so it cannot tell a screen whether the server has
    // answered. A screen gating on `loading` alone blanks itself on every
    // mount: `cache-and-network` reports `loading: true` for the whole network
    // leg even when the cache already answered, and `nextFetchPolicy` does not
    // survive an unmount (useQuery builds a new ObservableQuery per mount).
    hasPreferences: !!preferences,
    skipped,
    error,
    refetch,
    updateNotificationSetting,
    resetToDefaults,
    isQuietTime,
  };
};
