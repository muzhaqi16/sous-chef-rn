'use no memo';

import { act, waitFor } from '@testing-library/react-native';
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
import { useNotificationSettings } from '../useNotificationSettings';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

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

const mockPreferencesData = {
  __typename: 'NotificationPreferences' as const,
  id: 'pref-1',
  emailEnabled: true,
  pushEnabled: true,
  smsEnabled: false,
  expirationNotifications: true,
  expirationNotificationFrequency: ExpirationFrequency.DailyMorning,
  expirationDaysThreshold: 5,
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
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: 'America/New_York',
};

jest.mock('#/utils/finallyHelpers');

// Pinned so the timezone self-heal stays inert for every suite that isn't
// exercising it — otherwise the effect fires an unmocked mutation on whatever
// zone the test machine happens to be in.
jest.mock('#/utils/notifications/quietHours', () => ({
  ...jest.requireActual('#/utils/notifications/quietHours'),
  getDeviceTimezone: jest.fn(() => 'America/New_York'),
}));
const mockGetDeviceTimezone = jest.requireMock(
  '#/utils/notifications/quietHours',
).getDeviceTimezone as jest.Mock;

jest.mock('#/services/errorService');

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDeviceTimezone.mockReturnValue('America/New_York');
});

/**
 * The preferences query, as a PER-OPERATION mock — the form that composes.
 *
 * A schema-driven `mocks` map spread alongside `operationMocks` does NOT
 * compose: the wrapper discards it, the query goes unanswered, the hook runs on
 * its defaults, and every test here still passes — `showWarnings={false}` hides
 * the unanswered operation and `errorPolicy: 'all'` routes the failure into an
 * `error` field nothing reads. The two strategies are mutually exclusive by
 * type, so the mistake cannot be made here.
 */
function withPrefs(prefs: typeof mockPreferencesData | null) {
  return {
    operationMocks: [
      prefs === null
        ? recordMock(GetNotificationPreferencesDocument, {
            data: {
              me: {
                __typename: 'User' as const,
                id: 'user-1',
                notificationPreferences: null,
              },
            },
            maxUsageCount: Number.POSITIVE_INFINITY,
          }).mock
        : prefsQueryMock(prefs),
    ],
  };
}

/**
 * The success member of UpdateNotificationPreferencesResult, echoing back the
 * full entity the way the server does. Apollo normalizes it by id, which is
 * what makes the toggle stick — a placeholder payload would never exercise
 * that write.
 */
/**
 * `operationMocks` replaces the schema-driven link entirely, so tests that read
 * `settings` back out of the cache have to mock the query explicitly too.
 */
function prefsQueryMock(patch: Partial<typeof mockPreferencesData> = {}) {
  return recordMock(GetNotificationPreferencesDocument, {
    data: {
      me: {
        __typename: 'User' as const,
        id: 'user-1',
        notificationPreferences: {
          ...mockPreferencesData,
          userId: 'user-1',
          ...patch,
        },
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
  }).mock;
}

function updatedPrefs(patch: Partial<typeof mockPreferencesData>) {
  return {
    updateNotificationPreferences: {
      __typename: 'UpdateNotificationPreferencesPayload' as const,
      notificationPreferences: {
        ...mockPreferencesData,
        userId: 'user-1',
        ...patch,
      },
    },
  };
}

describe('useNotificationSettings', () => {
  it('returns settings from query data', async () => {
    const { result } = renderHookWithApollo(
      () => useNotificationSettings(),
      withPrefs(mockPreferencesData),
    );

    await waitFor(() =>
      expect(result.current.settings.expirationDaysThreshold).toBe(5),
    );
    expect(result.current.settings.emailEnabled).toBe(true);
    expect(result.current.settings.pushEnabled).toBe(true);
    expect(result.current.settings.smsEnabled).toBe(false);
  });

  it('returns defaults when no preferences data', async () => {
    const { result } = renderHookWithApollo(
      () => useNotificationSettings(),
      withPrefs(null),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.emailEnabled).toBe(true);
    expect(result.current.settings.pushEnabled).toBe(false);
    expect(result.current.settings.expirationDaysThreshold).toBe(3);
  });

  it('returns loading state', async () => {
    const { result } = renderHookWithApollo(
      () => useNotificationSettings(),
      withPrefs(mockPreferencesData),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loading).toBe(false);
  });

  it('updateNotificationSetting calls mutation with nested input', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ pushEnabled: true }),
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      operationMocks: [
        ...withPrefs(mockPreferencesData).operationMocks,
        update.mock,
      ],
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.updateNotificationSetting(
        'pushEnabled',
        true,
      );
    });

    expect(update.fired).toContainEqual({
      input: { channels: { pushEnabled: true } },
    });
    expect(success).toBe(true);
  });

  it('reflects the server-confirmed value so the toggle stays put', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ pushEnabled: false }),
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      operationMocks: [prefsQueryMock(), update.mock],
    });

    await waitFor(() => expect(result.current.settings.pushEnabled).toBe(true));

    await act(async () => {
      await result.current.updateNotificationSetting('pushEnabled', false);
    });

    expect(result.current.settings.pushEnabled).toBe(false);
  });

  it('applies the change optimistically before the server responds', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ pushEnabled: false }),
      delay: 200,
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      operationMocks: [prefsQueryMock(), update.mock],
    });

    await waitFor(() => expect(result.current.settings.pushEnabled).toBe(true));

    let pending: Promise<boolean> | undefined;
    await act(async () => {
      pending = result.current.updateNotificationSetting('pushEnabled', false);
      await Promise.resolve();
    });

    // The mock has not replied yet — this value can only come from the
    // optimistic layer.
    expect(result.current.settings.pushEnabled).toBe(false);

    await act(async () => {
      await pending;
    });
  });

  it('reports failure when the server returns an error member', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: {
        updateNotificationPreferences: {
          __typename: 'ForbiddenError' as const,
          code: ErrorCode.Forbidden,
          message: 'Push requires a registered device',
        },
      },
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      operationMocks: [prefsQueryMock({ pushEnabled: false }), update.mock],
    });

    await waitFor(() =>
      expect(result.current.settings.pushEnabled).toBe(false),
    );

    let success: boolean = true;
    await act(async () => {
      success = await result.current.updateNotificationSetting(
        'pushEnabled',
        true,
      );
    });

    expect(success).toBe(false);
    expect(result.current.settings.pushEnabled).toBe(false);
  });

  it('updateNotificationSetting maps feature keys correctly', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ lowStockAlerts: false }),
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      operationMocks: [
        ...withPrefs(mockPreferencesData).operationMocks,
        update.mock,
      ],
    });

    await act(async () => {
      await result.current.updateNotificationSetting('lowStockAlerts', false);
    });

    expect(update.fired).toContainEqual({
      input: { features: { lowStockAlerts: false } },
    });
  });

  it('updateNotificationSetting maps expiration keys correctly', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ expirationDaysThreshold: 7 }),
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      operationMocks: [
        ...withPrefs(mockPreferencesData).operationMocks,
        update.mock,
      ],
    });

    await act(async () => {
      await result.current.updateNotificationSetting(
        'expirationDaysThreshold',
        7,
      );
    });

    expect(update.fired).toContainEqual({
      input: { expiration: { expirationDaysThreshold: 7 } },
    });
  });

  it('updateMultipleSettings sends batch update', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ pushEnabled: true, lowStockAlerts: false }),
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      operationMocks: [
        ...withPrefs(mockPreferencesData).operationMocks,
        update.mock,
      ],
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.updateMultipleSettings({
        pushEnabled: true,
        lowStockAlerts: false,
      });
    });

    expect(update.fired.length).toBeGreaterThan(0);
    expect(success).toBe(true);
  });

  it('resetToDefaults sends default values', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: updatedPrefs({ pushEnabled: false }),
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      operationMocks: [
        ...withPrefs(mockPreferencesData).operationMocks,
        update.mock,
      ],
    });

    await act(async () => {
      await result.current.resetToDefaults();
    });

    expect(update.fired.length).toBeGreaterThan(0);
  });

  it('isQuietTime returns false when quiet hours disabled', async () => {
    const { result } = renderHookWithApollo(
      () => useNotificationSettings(),
      withPrefs(mockPreferencesData),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isQuietTime()).toBe(false);
  });

  it('isQuietTime evaluates correctly when enabled', async () => {
    const { result } = renderHookWithApollo(
      () => useNotificationSettings(),
      withPrefs({
        ...mockPreferencesData,
        quietHoursEnabled: true,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
      }),
    );
    await waitFor(() =>
      expect(result.current.settings.quietHoursEnabled).toBe(true),
    );
    expect(result.current.isQuietTime()).toBe(true);
  });

  describe('quiet-hours timezone self-heal', () => {
    it('rewrites the API default of UTC to the device zone', async () => {
      const update = recordMock(UpdateNotificationPreferencesDocument, {
        data: updatedPrefs({
          quietHoursEnabled: true,
          quietHoursTimezone: 'America/New_York',
        }),
      });

      renderHookWithApollo(() => useNotificationSettings(), {
        operationMocks: [
          prefsQueryMock({
            quietHoursEnabled: true,
            quietHoursTimezone: 'UTC',
          }),
          update.mock,
        ],
      });

      await waitFor(() =>
        expect(update.fired).toContainEqual({
          input: { quietHours: { quietHoursTimezone: 'America/New_York' } },
        }),
      );
    });

    it('leaves a matching zone alone', async () => {
      const update = recordMock(UpdateNotificationPreferencesDocument, {
        data: updatedPrefs({ quietHoursEnabled: true }),
      });

      const { result } = renderHookWithApollo(() => useNotificationSettings(), {
        operationMocks: [
          prefsQueryMock({
            quietHoursEnabled: true,
            quietHoursTimezone: 'America/New_York',
          }),
          update.mock,
        ],
      });

      await waitFor(() =>
        expect(result.current.settings.quietHoursEnabled).toBe(true),
      );
      expect(update.fired).toEqual([]);
    });

    it('stays quiet while quiet hours are disabled', async () => {
      const update = recordMock(UpdateNotificationPreferencesDocument, {
        data: updatedPrefs({}),
      });

      const { result } = renderHookWithApollo(() => useNotificationSettings(), {
        operationMocks: [
          prefsQueryMock({
            quietHoursEnabled: false,
            quietHoursTimezone: 'UTC',
          }),
          update.mock,
        ],
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(update.fired).toEqual([]);
    });
  });
});
