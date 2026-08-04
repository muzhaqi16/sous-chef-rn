/**
 * Does a `cache.modify` on the settings entity reach a component rendering the
 * query? Both settings screens write the change into the cache before firing
 * their mutation (`updateEntityFieldsLocalFirst`), and the switch renders from
 * the query — so if this broadcast doesn't land, the control can't move until
 * the server responds, which is the "have to tap it twice" report.
 *
 * This isolates the cache→render half. If it passes, the write propagates and
 * any remaining stuck switch is a native `Switch` issue, not an Apollo one.
 */
import { useQuery } from '@apollo/client/react';
import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { GetNotificationPreferencesDocument } from '#operations/user/user.generated';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { writeEntityFields } from '#/apollo/utils/localFirstFields';

describe('settings cache broadcast', () => {
  it('a cache.modify on NotificationPreferences re-renders the query', async () => {
    const cache = makeCache();
    const { result } = renderHookWithApollo(
      () => useQuery(GetNotificationPreferencesDocument),
      {
        cache,
        mocks: {
          Query: () => ({
            me: {
              id: 'user-1',
              notificationPreferences: {
                id: 'prefs-1',
                pushEnabled: false,
              },
            },
          }),
        },
      },
    );

    await waitFor(() =>
      expect(
        result.current.data?.me?.notificationPreferences?.pushEnabled,
      ).toBe(false),
    );

    act(() => {
      writeEntityFields(
        cache,
        { __typename: 'NotificationPreferences', id: 'prefs-1' },
        { pushEnabled: true },
      );
    });

    await waitFor(() =>
      expect(
        result.current.data?.me?.notificationPreferences?.pushEnabled,
      ).toBe(true),
    );
  });

  it('a cache.modify on UserSettings re-renders the query', async () => {
    const cache = makeCache();
    const { result } = renderHookWithApollo(
      () => useQuery(GetUserSettingsDocument),
      {
        cache,
        mocks: {
          Query: () => ({
            me: {
              id: 'user-1',
              settings: { id: 'settings-1', offlineMode: false },
            },
          }),
        },
      },
    );

    await waitFor(() =>
      expect(result.current.data?.me?.settings?.offlineMode).toBe(false),
    );

    act(() => {
      writeEntityFields(
        cache,
        { __typename: 'UserSettings', id: 'settings-1' },
        { offlineMode: true },
      );
    });

    await waitFor(() =>
      expect(result.current.data?.me?.settings?.offlineMode).toBe(true),
    );
  });
});
