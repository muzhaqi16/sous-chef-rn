import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { mockAppStore } from '#/test-utils/mockAppStore';
import {
  GetUserSettingsDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import { UnitSystem } from '#/graphql/generated/schemaTypes';
import { useAppSettings } from '../useAppSettings';

jest.mock('#store/useAppStore', () =>
  mockAppStore({ user: { id: 'user-1' } as never }),
);

const PICKER = 'consumptionUnitsForPantryItem({"pantryItemId":"p1"})';

/** A cache already holding one picker's answer, in the old unit system. */
const cacheWithPicker = () => {
  const cache = makeCache();
  cache.restore({ ROOT_QUERY: { __typename: 'Query', [PICKER]: [] } });
  return cache;
};

const holdsPicker = (cache: ReturnType<typeof makeCache>) =>
  PICKER in (cache.extract().ROOT_QUERY ?? {});

const settingsMock = (
  settings: { preferredUnitSystem: UnitSystem } | null = {
    preferredUnitSystem: UnitSystem.Metric,
  },
) => {
  const data: MockDataFor<typeof GetUserSettingsDocument> = {
    me: {
      __typename: 'User',
      id: 'user-1',
      settings: settings && {
        __typename: 'UserSettings',
        id: 'settings-1',
        ...settings,
      },
    },
  };
  return recordMock(GetUserSettingsDocument, { data });
};

const applied = () => {
  const data: MockDataFor<typeof UpdateUserPreferencesDocument> = {
    updateSettings: {
      __typename: 'UpdateSettingsPayload',
      userSettings: {
        __typename: 'UserSettings',
        id: 'settings-1',
        preferredUnitSystem: UnitSystem.Imperial,
      },
    },
  };
  return recordMock(UpdateUserPreferencesDocument, { data });
};

/** What the offline queue resolves with: no payload, no error. */
const queued = () => {
  const data: MockDataFor<typeof UpdateUserPreferencesDocument> = {
    updateSettings: null,
  };
  return recordMock(UpdateUserPreferencesDocument, { data });
};

const renderSettings = (
  cache: ReturnType<typeof makeCache>,
  mocks: ReturnType<typeof recordMock>[],
) =>
  renderHookWithApollo(() => useAppSettings(), {
    cache,
    operationMocks: mocks.map(mock => mock.mock),
  });

describe('useAppSettings', () => {
  it('reads Device default for an account with no settings row, as the server does', async () => {
    const { result } = renderSettings(makeCache(), [settingsMock(null)]);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settings.preferredUnitSystem).toBe(UnitSystem.System);
  });

  describe('a unit-system change', () => {
    it('drops the pickers once the server applies it', async () => {
      const cache = cacheWithPicker();
      const { result } = renderSettings(cache, [settingsMock(), applied()]);
      await waitFor(() => expect(result.current.hasLoadedSettings).toBe(true));

      await act(async () => {
        await result.current.updateAppSetting(
          'preferredUnitSystem',
          UnitSystem.Imperial,
        );
      });

      expect(holdsPicker(cache)).toBe(false);
    });

    it('keeps them while the change waits in the queue', async () => {
      const cache = cacheWithPicker();
      const { result } = renderSettings(cache, [settingsMock(), queued()]);
      await waitFor(() => expect(result.current.hasLoadedSettings).toBe(true));

      await act(async () => {
        await result.current.updateAppSetting(
          'preferredUnitSystem',
          UnitSystem.Imperial,
        );
      });

      expect(holdsPicker(cache)).toBe(true);
    });
  });

  it('keeps them for any other setting', async () => {
    const cache = cacheWithPicker();
    const { result } = renderSettings(cache, [settingsMock(), applied()]);
    await waitFor(() => expect(result.current.hasLoadedSettings).toBe(true));

    await act(async () => {
      await result.current.updateAppSetting('autoSync', false);
    });

    expect(holdsPicker(cache)).toBe(true);
  });

  it('resets the unit system to Device default', async () => {
    const reset = applied();
    const { result } = renderSettings(makeCache(), [settingsMock(), reset]);
    await waitFor(() => expect(result.current.hasLoadedSettings).toBe(true));

    await act(async () => {
      await result.current.resetToDefaults();
    });

    expect(reset.fired[0]).toMatchObject({
      input: { regional: { preferredUnitSystem: UnitSystem.System } },
    });
  });
});
