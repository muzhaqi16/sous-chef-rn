import { act, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
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
import {
  ErrorCode,
  ExpirationFrequency,
} from '#/graphql/generated/schemaTypes';
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
  __typename: 'NotificationPreferences',
  id: 'pref-1',
  emailEnabled: true,
  pushEnabled: true,
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
  weeklyDigest: true,
  monthlyReport: false,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: 'UTC',
};

const prefsQueryMock = (patch: Partial<typeof basePreferences> = {}) => {
  const data: MockDataFor<typeof GetNotificationPreferencesDocument> = {
    me: {
      __typename: 'User',
      id: 'user-1',
      notificationPreferences: {
        ...basePreferences,
        userId: 'user-1',
        ...patch,
      },
    },
  };
  return recordMock(GetNotificationPreferencesDocument, {
    data,
    maxUsageCount: Number.POSITIVE_INFINITY,
  }).mock;
};

const updatedPrefs = (
  patch: Partial<typeof basePreferences>,
): MockDataFor<typeof UpdateNotificationPreferencesDocument> => ({
  updateNotificationPreferences: {
    __typename: 'UpdateNotificationPreferencesPayload',
    notificationPreferences: {
      ...basePreferences,
      userId: 'user-1',
      ...patch,
    },
  },
});

/** The account's settings as the server holds them; `null` is no row yet. */
const settingsQueryMock = (timezone: string | null = 'America/New_York') => {
  const data: MockDataFor<typeof GetUserSettingsDocument> = {
    me: {
      __typename: 'User',
      id: 'user-1',
      settings:
        timezone === null
          ? null
          : { __typename: 'UserSettings', id: 'settings-1', timezone },
    },
  };
  return recordMock(GetUserSettingsDocument, {
    data,
    maxUsageCount: Number.POSITIVE_INFINITY,
  }).mock;
};

const settingsUpdate = (timezone: string) => {
  const data: MockDataFor<typeof UpdateUserPreferencesDocument> = {
    updateSettings: {
      __typename: 'UpdateSettingsPayload',
      userSettings: { __typename: 'UserSettings', id: 'settings-1', timezone },
    },
  };
  return recordMock(UpdateUserPreferencesDocument, { data });
};

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
  it('rewrites the API default of UTC to the device zone', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ quietHoursTimezone: 'America/New_York' }),
    });

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      operationMocks: [prefsQueryMock(), settingsQueryMock(), update.mock],
    });

    await waitFor(() =>
      expect(update.fired).toContainEqual({
        input: { quietHours: { quietHoursTimezone: 'America/New_York' } },
      }),
    );
  });

  it('leaves a matching zone alone', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({}),
    });

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      operationMocks: [
        prefsQueryMock({ quietHoursTimezone: 'America/New_York' }),
        settingsQueryMock(),
        update.mock,
      ],
    });

    await waitFor(() => expect(update.fired).toEqual([]));
  });

  // A morning meal-plan reminder is scheduled in this zone too.
  it('keeps the zone in step while quiet hours are off', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ quietHoursTimezone: 'America/New_York' }),
    });

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      operationMocks: [
        prefsQueryMock({ quietHoursEnabled: false }),
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

  it('does not write when the device reports no zone', async () => {
    mockGetDeviceTimezone.mockReturnValue(null);
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({}),
    });

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      operationMocks: [prefsQueryMock(), settingsQueryMock(), update.mock],
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

  it('leaves settings that already hold the device zone alone', async () => {
    const cache = makeCache();
    const update = settingsUpdate('America/New_York');

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      cache,
      operationMocks: [matchingPrefs(), settingsQueryMock(), update.mock],
    });

    await waitFor(() =>
      expect(heldSettingsZone(cache)).toBe('America/New_York'),
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

  // Writing would create the row, and a row reads as a currency chosen.
  it('creates no settings for an account that has none', async () => {
    const cache = makeCache();
    const update = settingsUpdate('America/New_York');

    renderHookWithApollo(() => useDeviceTimezoneSync(), {
      cache,
      operationMocks: [matchingPrefs(), settingsQueryMock(null), update.mock],
    });

    await waitFor(() =>
      expect(
        cache.readQuery({ query: GetUserSettingsDocument })?.me?.settings,
      ).toBeNull(),
    );
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(update.fired).toEqual([]);
  });

  it('follows the device to another zone when the app returns to the foreground', async () => {
    const listeners: Array<(state: AppStateStatus) => void> = [];
    jest
      .mocked(AppState.addEventListener)
      .mockImplementation((_type, listener) => {
        listeners.push(listener);
        return { remove: jest.fn() };
      });
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

    mockGetDeviceTimezone.mockReturnValue('Europe/Rome');
    act(() => listeners.forEach(listener => listener('active')));

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
