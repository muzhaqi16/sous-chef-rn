import { act, waitFor } from '@testing-library/react-native';
import { memoryLifecycle } from '#/test-utils/memoryPlatform';
import { makeCache } from '#/apollo/cache';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  GetNotificationPreferencesDocument,
  UpdateNotificationPreferencesDocument,
} from '#operations/user/user.generated';
import {
  GetUserSettingsDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { useDeviceTimezoneSync } from '../useDeviceTimezoneSync';

jest.mock('#/services/errorService');

jest.mock('#store/useAppStore', () => {
  const getState = () => ({ user: { id: 'user-1' } });
  return {
    useAppStore: jest.fn(
      (selector: (state: ReturnType<typeof getState>) => unknown) =>
        selector(getState()),
    ),
    useUser: () => (s => s.user)(getState()),
    useUserId: () => (s => s.user?.id)(getState()),
  };
});

jest.mock('#features/notifications/utils/quietHours', () => ({
  ...jest.requireActual('#features/notifications/utils/quietHours'),
  getDeviceTimezone: jest.fn(() => 'America/New_York'),
}));
const mockGetDeviceTimezone = jest.requireMock(
  '#features/notifications/utils/quietHours',
).getDeviceTimezone as jest.Mock;

type StoredPreferences = NonNullable<
  NonNullable<
    MockDataFor<typeof GetNotificationPreferencesDocument>['me']
  >['notificationPreferences']
>;

const basePreferences: StoredPreferences = {
  id: 'pref-1',
  quietHoursEnabled: true,
  quietHoursTimezone: 'UTC',
};

const prefsQueryMock = (patch: StoredPreferences = {}) =>
  recordMock(GetNotificationPreferencesDocument, {
    data: {
      me: {
        id: 'user-1',
        notificationPreferences: { ...basePreferences, ...patch },
      },
    },
  }).mock;

const updatedPrefs = (
  patch: StoredPreferences,
): MockDataFor<typeof UpdateNotificationPreferencesDocument> => ({
  updateNotificationPreferences: {
    __typename: 'UpdateNotificationPreferencesPayload',
    notificationPreferences: { ...basePreferences, ...patch },
  },
});

/** The account's settings as the server holds them; `null` is no row yet. */
const settingsQueryMock = (timezone: string | null = 'America/New_York') =>
  recordMock(GetUserSettingsDocument, {
    data: {
      me: {
        id: 'user-1',
        settings: timezone === null ? null : { id: 'settings-1', timezone },
      },
    },
  }).mock;

const settingsUpdate = (timezone: string) =>
  recordMock(UpdateUserPreferencesDocument, {
    data: {
      updateSettings: {
        __typename: 'UpdateSettingsPayload',
        userSettings: { id: 'settings-1', timezone },
      },
    },
  });

const heldSettingsZone = (cache: ReturnType<typeof makeCache>) =>
  cache.readQuery({ query: GetUserSettingsDocument })?.me?.settings?.timezone;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDeviceTimezone.mockReturnValue('America/New_York');
});

/**
 * `quietHoursTimezone` is the only timezone the API reads when it defers a push
 * or schedules a reminder or digest, and it defaults to "UTC" — where a
 * 22:00–08:00 window mutes mid-afternoon in New York. `registerDevice` carries
 * a timezone too, but nothing reads it.
 */
describe('useDeviceTimezoneSync', () => {
  // A morning meal-plan reminder is scheduled in this zone too, so it is kept
  // in step whether or not quiet hours are on.
  it.each<[string, StoredPreferences]>([
    ['rewrites the API default of UTC to the device zone', {}],
    [
      'keeps the zone in step while quiet hours are off',
      { quietHoursEnabled: false },
    ],
  ])('%s', async (_name, stored) => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ quietHoursTimezone: 'America/New_York' }),
    });

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      operationMocks: [
        prefsQueryMock(stored),
        settingsQueryMock(),
        update.mock,
      ],
    });

    await waitFor(() =>
      expect(update.fired).toContainEqual({
        input: { quietHours: { quietHoursTimezone: 'America/New_York' } },
      }),
    );
  });

  it.each<[string, StoredPreferences, string | null]>([
    [
      'leaves a matching zone alone',
      { quietHoursTimezone: 'America/New_York' },
      'America/New_York',
    ],
    ['does not write when the device reports no zone', {}, null],
  ])('%s', async (_name, stored, deviceZone) => {
    mockGetDeviceTimezone.mockReturnValue(deviceZone);
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({}),
    });

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      operationMocks: [
        prefsQueryMock(stored),
        settingsQueryMock(),
        update.mock,
      ],
    });

    await waitFor(() => expect(update.fired).toEqual([]));
  });

  /**
   * The API validates this field now, so a refusal is a real answer rather than
   * a transient miss. Latching on it would leave the account on a window the
   * server reads in the wrong zone for the life of the install.
   */
  it('writes once per zone rather than on every render', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ quietHoursTimezone: 'America/New_York' }),
    });

    const { rerender } = renderHookWithApollo(() => useDeviceTimezoneSync(), {
      operationMocks: [prefsQueryMock(), settingsQueryMock(), update.mock],
    });

    await waitFor(() => expect(update.fired).toHaveLength(1));
    rerender({});
    rerender({});
    expect(update.fired).toHaveLength(1);
  });

  /**
   * The local-first write reverts the cached field on a refusal, moving the
   * effect's dependency back to the value that triggered it — so a latch cleared
   * on failure retries forever. The retry belongs on the next launch instead.
   */
  it('does not retry a refused write within the same mount', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: {
        updateNotificationPreferences: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'Invalid timezone',
          field: 'quietHours.quietHoursTimezone',
        },
      },
    });

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      operationMocks: [prefsQueryMock(), settingsQueryMock(), update.mock],
    });

    await waitFor(() => expect(update.fired).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(update.fired).toHaveLength(1);
  });
});

/**
 * The settings' own zone times every scheduled send while quiet hours name
 * UTC, and defaults to "UTC" too.
 */
describe('useDeviceTimezoneSync — the settings zone', () => {
  const matchingPrefs = () =>
    prefsQueryMock({ quietHoursTimezone: 'America/New_York' });

  it('writes the device zone to settings that hold another', async () => {
    const cache = makeCache();
    const update = settingsUpdate('America/New_York');

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      cache,
      operationMocks: [matchingPrefs(), settingsQueryMock('UTC'), update.mock],
    });

    await waitFor(() =>
      expect(update.fired).toEqual([
        { input: { regional: { timezone: 'America/New_York' } } },
      ]),
    );
    expect(heldSettingsZone(cache)).toBe('America/New_York');
  });

  // An account with no settings gets none: a row reads as a currency chosen.
  it.each<[string, string | null]>([
    [
      'leaves settings that already hold the device zone alone',
      'America/New_York',
    ],
    ['creates no settings for an account that has none', null],
  ])('%s', async (_name, held) => {
    const cache = makeCache();
    const update = settingsUpdate('America/New_York');

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      cache,
      operationMocks: [matchingPrefs(), settingsQueryMock(held), update.mock],
    });

    await waitFor(() =>
      expect(
        cache.readQuery({ query: GetUserSettingsDocument })?.me,
      ).toMatchObject({ settings: held === null ? null : { timezone: held } }),
    );
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(update.fired).toEqual([]);
  });

  it('does not retry a refused settings write within the same mount', async () => {
    const cache = makeCache();
    const update = recordMock(UpdateUserPreferencesDocument, {
      data: {
        updateSettings: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'Invalid timezone',
          field: 'regional.timezone',
        },
      },
    });

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      cache,
      operationMocks: [matchingPrefs(), settingsQueryMock('UTC'), update.mock],
    });

    await waitFor(() => expect(update.fired).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(update.fired).toHaveLength(1);
    // The refusal puts the zone the server holds back.
    expect(heldSettingsZone(cache)).toBe('UTC');
  });

  it('follows the device to another zone when the app returns to the foreground', async () => {
    const cache = makeCache();
    const settings = settingsUpdate('Europe/Rome');
    const preferences = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ quietHoursTimezone: 'Europe/Rome' }),
    });

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      cache,
      operationMocks: [
        matchingPrefs(),
        settingsQueryMock(),
        settings.mock,
        preferences.mock,
      ],
    });
    await waitFor(() =>
      expect(heldSettingsZone(cache)).toBe('America/New_York'),
    );
    expect(settings.fired).toEqual([]);

    act(() => memoryLifecycle().moveTo('background'));
    mockGetDeviceTimezone.mockReturnValue('Europe/Rome');
    act(() => memoryLifecycle().moveTo('active'));

    await waitFor(() =>
      expect(settings.fired).toEqual([
        { input: { regional: { timezone: 'Europe/Rome' } } },
      ]),
    );
    await waitFor(() =>
      expect(preferences.fired).toEqual([
        { input: { quietHours: { quietHoursTimezone: 'Europe/Rome' } } },
      ]),
    );
    expect(heldSettingsZone(cache)).toBe('Europe/Rome');
  });
});
