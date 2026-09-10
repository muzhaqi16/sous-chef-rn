import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  GetNotificationPreferencesDocument,
  UpdateNotificationPreferencesDocument,
} from '#operations/user/user.generated';
import {
  ErrorCode,
  ExpirationFrequency,
} from '#/graphql/generated/schemaTypes';
import { useQuietHoursTimezoneSync } from '../useQuietHoursTimezoneSync';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/utils/finallyHelpers');
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

const basePreferences = {
  __typename: 'NotificationPreferences' as const,
  id: 'pref-1',
  emailEnabled: true,
  pushEnabled: true,
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
  weeklyDigest: true,
  monthlyReport: false,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: 'UTC',
};

const prefsQueryMock = (patch: Partial<typeof basePreferences> = {}) =>
  recordMock(GetNotificationPreferencesDocument, {
    data: {
      me: {
        __typename: 'User' as const,
        id: 'user-1',
        notificationPreferences: {
          ...basePreferences,
          userId: 'user-1',
          ...patch,
        },
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
  }).mock;

const updatedPrefs = (patch: Partial<typeof basePreferences>) => ({
  updateNotificationPreferences: {
    __typename: 'UpdateNotificationPreferencesPayload' as const,
    notificationPreferences: {
      ...basePreferences,
      userId: 'user-1',
      ...patch,
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDeviceTimezone.mockReturnValue('America/New_York');
});

/**
 * `quietHoursTimezone` is the only timezone the API reads when it defers a push,
 * and it defaults to "UTC" — where a 22:00–08:00 window mutes mid-afternoon in
 * New York. `registerDevice` carries a timezone too, but nothing reads it.
 */
describe('useQuietHoursTimezoneSync', () => {
  it('rewrites the API default of UTC to the device zone', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ quietHoursTimezone: 'America/New_York' }),
    });

    renderHookWithApollo(() => useQuietHoursTimezoneSync(), {
      operationMocks: [prefsQueryMock(), update.mock],
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

    renderHookWithApollo(() => useQuietHoursTimezoneSync(), {
      operationMocks: [
        prefsQueryMock({ quietHoursTimezone: 'America/New_York' }),
        update.mock,
      ],
    });

    await waitFor(() => expect(update.fired).toEqual([]));
  });

  it('stays quiet while quiet hours are disabled', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({}),
    });

    renderHookWithApollo(() => useQuietHoursTimezoneSync(), {
      operationMocks: [
        prefsQueryMock({ quietHoursEnabled: false }),
        update.mock,
      ],
    });

    await waitFor(() => expect(update.fired).toEqual([]));
  });

  it('does not write when the device reports no zone', async () => {
    mockGetDeviceTimezone.mockReturnValue(null);
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({}),
    });

    renderHookWithApollo(() => useQuietHoursTimezoneSync(), {
      operationMocks: [prefsQueryMock(), update.mock],
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

    const { rerender } = renderHookWithApollo(
      () => useQuietHoursTimezoneSync(),
      { operationMocks: [prefsQueryMock(), update.mock] },
    );

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
          __typename: 'ValidationError' as const,
          code: ErrorCode.ValidationFailed,
          message: 'Invalid timezone',
          field: 'quietHours.quietHoursTimezone',
        },
      },
    });

    renderHookWithApollo(() => useQuietHoursTimezoneSync(), {
      operationMocks: [prefsQueryMock(), update.mock],
    });

    await waitFor(() => expect(update.fired).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(update.fired).toHaveLength(1);
  });
});
