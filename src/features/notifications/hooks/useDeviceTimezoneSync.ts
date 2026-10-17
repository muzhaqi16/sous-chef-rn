import { useEffect, useRef, useState, type RefObject } from 'react';
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
 * Writes the device's zone over `held` once per mount and zone: a refusal
 * reverts the field, which re-arms the effect, so retrying within the mount
 * loops. The next launch retries it.
 */
function writeZoneOnce(
  attemptedFor: RefObject<string | null>,
  deviceTimezone: string,
  held: string | null | undefined,
  refusal: string,
  write: () => Promise<boolean>,
): void {
  if (held === deviceTimezone || attemptedFor.current === deviceTimezone) {
    return;
  }
  attemptedFor.current = deviceTimezone;
  void write().then(persisted => {
    if (!persisted) logger.warn(refusal, { deviceTimezone });
  });
}

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
    if (!deviceTimezone || !preferencesId) return;
    const updates: Partial<NotificationSettings> = {
      quietHoursTimezone: deviceTimezone,
    };
    writeZoneOnce(
      attemptedFor,
      deviceTimezone,
      quietHoursTimezone,
      'Quiet-hours timezone sync refused',
      () =>
        applySettingsUpdate({
          cache: client.cache,
          entity: { __typename: 'NotificationPreferences', id: preferencesId },
          updates,
          previous: snapshotFields({ quietHoursTimezone }, updates),
          mutate: input => updatePreferences({ variables: { input } }),
        }),
    );
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
    if (!deviceTimezone || !settingsId) return;
    const updates = { timezone: deviceTimezone };
    writeZoneOnce(
      settingsAttemptedFor,
      deviceTimezone,
      settingsTimezone,
      'Settings timezone sync refused',
      () =>
        updateEntityFieldsLocalFirst({
          cache: client.cache,
          entity: { __typename: 'UserSettings', id: settingsId },
          updates,
          previous: snapshotFields({ timezone: settingsTimezone }, updates),
          settle: () =>
            settleMutation(
              () =>
                updateSettings({
                  variables: {
                    input: { regional: { timezone: deviceTimezone } },
                  },
                }),
              {
                document: UpdateUserPreferencesDocument,
                fallback: t('settings.updateFailed'),
                present: 'none',
              },
            ),
        }),
    );
  }, [client, deviceTimezone, settingsId, settingsTimezone, updateSettings]);
};
