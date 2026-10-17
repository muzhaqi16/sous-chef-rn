import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
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
  GetUserSettingsDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import { useUser } from '#store/useAppStore';
import {
  snapshotFields,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { getDeviceTimezone } from '#features/notifications/utils/quietHours';
import { logger } from '#/utils/environment';
import { t } from '#/i18n';
import {
  applySettingsUpdate,
  type NotificationSettings,
} from './useNotificationSettings';

/**
 * Points the account's two zones at the device's, each "UTC" until written.
 * The API times quiet hours and every scheduled send (reminders, digests) in
 * `quietHoursTimezone`, whether or not quiet hours are on, and in the settings'
 * `timezone` while quiet hours name UTC (`registerDevice`'s zone is stored and
 * ignored). App-wide so a traveller re-syncs without opening a screen.
 */
export const useDeviceTimezoneSync = (): void => {
  const user = useUser();
  const client = useApolloClient();

  // cache-first: the reconciliation is background work and the persisted cache
  // already holds both on any launch that could need them, so it must not add
  // a network leg to startup.
  const { data } = useQuery(
    GetNotificationPreferencesDocument,
    user?.id ? { fetchPolicy: 'cache-first' } : skipToken,
  );
  const { data: settingsData } = useQuery(
    GetUserSettingsDocument,
    user?.id ? { fetchPolicy: 'cache-first' } : skipToken,
  );
  const [updatePreferences] = useMutation(
    UpdateNotificationPreferencesDocument,
    { context: { localFirst: true } },
  );
  const [updateSettings] = useMutation(UpdateUserPreferencesDocument, {
    context: { localFirst: true },
  });

  const preferences = data?.me?.notificationPreferences;
  const preferencesId = preferences?.id;
  const quietHoursTimezone = preferences?.quietHoursTimezone;
  const settings = settingsData?.me?.settings;
  const settingsId = settings?.id;
  const settingsTimezone = settings?.timezone;

  // The zone a write was attempted for this mount, per field. Never cleared:
  // the local-first write reverts the cached field on a refusal, which moves
  // the effect's dependency back to the value that triggered it, so retrying
  // within the mount is an unbounded loop. A refusal is retried next launch.
  const attemptedFor = useRef<string | null>(null);
  const settingsAttemptedFor = useRef<string | null>(null);

  // Re-sampled on foreground: read once at mount, it answers for every session
  // except the one the zone changes in — the one this hook exists for.
  const [deviceTimezone, setDeviceTimezone] = useState(getDeviceTimezone);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') setDeviceTimezone(getDeviceTimezone());
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (
      !deviceTimezone ||
      !preferencesId ||
      quietHoursTimezone === deviceTimezone ||
      attemptedFor.current === deviceTimezone
    ) {
      return;
    }

    attemptedFor.current = deviceTimezone;
    const updates: Partial<NotificationSettings> = {
      quietHoursTimezone: deviceTimezone,
    };

    void applySettingsUpdate({
      cache: client.cache,
      entity: { __typename: 'NotificationPreferences', id: preferencesId },
      updates,
      previous: snapshotFields({ quietHoursTimezone }, updates),
      mutate: input =>
        updatePreferences({
          variables: { input },
        }),
    }).then(persisted => {
      if (persisted) return;
      logger.warn('Quiet-hours timezone sync refused', { deviceTimezone });
    });
  }, [
    client,
    deviceTimezone,
    preferencesId,
    quietHoursTimezone,
    updatePreferences,
  ]);

  useEffect(() => {
    // No settings row yet: the first settings write creates one, and the
    // region-currency default reads "no row" as a currency never chosen.
    if (
      !deviceTimezone ||
      !settingsId ||
      settingsTimezone === deviceTimezone ||
      settingsAttemptedFor.current === deviceTimezone
    ) {
      return;
    }

    settingsAttemptedFor.current = deviceTimezone;
    const updates = { timezone: deviceTimezone };

    void updateEntityFieldsLocalFirst({
      cache: client.cache,
      entity: { __typename: 'UserSettings', id: settingsId },
      updates,
      previous: snapshotFields({ timezone: settingsTimezone }, updates),
      mutate: async () => {
        const settled = await settleMutation(
          () =>
            updateSettings({
              variables: { input: { regional: { timezone: deviceTimezone } } },
            }),
          {
            document: UpdateUserPreferencesDocument,
            fallback: t('settings.updateFailed'),
            present: 'none',
          },
        );
        return settled.failure
          ? { error: settled.failure }
          : { data: settled.data };
      },
      logLabel: 'Settings timezone sync',
    }).then(({ persisted }) => {
      if (persisted) return;
      logger.warn('Settings timezone sync refused', { deviceTimezone });
    });
  }, [client, deviceTimezone, settingsId, settingsTimezone, updateSettings]);
};
