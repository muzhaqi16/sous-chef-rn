import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import {
  GetNotificationPreferencesDocument,
  UpdateNotificationPreferencesDocument,
} from '#operations/user/user.generated';
import { useUser } from '#store/useAppStore';
import { snapshotFields } from '#/apollo/utils/localFirstFields';
import { getDeviceTimezone } from '#features/notifications/utils/quietHours';
import { logger } from '#/utils/environment';
import {
  applySettingsUpdate,
  type NotificationSettings,
} from './useNotificationSettings';

/**
 * Points `quietHoursTimezone` at the device's zone: it is the ONLY timezone the
 * API reads when deferring a push (`registerDevice`'s is stored and ignored),
 * and it defaults to "UTC", muting mid-afternoon in New York. App-wide so a
 * traveller re-syncs without opening a notification screen.
 */
export const useQuietHoursTimezoneSync = (): void => {
  const user = useUser();
  const client = useApolloClient();

  // cache-first: the reconciliation is background work and the persisted cache
  // already holds preferences on any launch that could need it, so it must not
  // add a network leg to startup.
  const { data } = useQuery(GetNotificationPreferencesDocument, {
    skip: !user?.id,
    fetchPolicy: 'cache-first',
  });
  const [updatePreferences] = useMutation(
    UpdateNotificationPreferencesDocument,
  );

  const preferences = data?.me?.notificationPreferences;
  const preferencesId = preferences?.id;
  const quietHoursEnabled = preferences?.quietHoursEnabled;
  const quietHoursTimezone = preferences?.quietHoursTimezone;

  // The zone a write was attempted for this mount. It is never cleared: the
  // local-first write reverts the cached field on a refusal, which moves the
  // effect's dependency back to the value that triggered it, so retrying within
  // the mount is an unbounded loop. A refusal is retried on the next launch.
  const attemptedFor = useRef<string | null>(null);

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
      !quietHoursEnabled ||
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
          context: { localFirst: true },
        }),
    }).then(persisted => {
      if (persisted) return;
      logger.warn('Quiet-hours timezone sync refused', { deviceTimezone });
    });
  }, [
    client,
    deviceTimezone,
    preferencesId,
    quietHoursEnabled,
    quietHoursTimezone,
    updatePreferences,
  ]);
};
