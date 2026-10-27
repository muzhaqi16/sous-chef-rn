import { makeCache } from '#/apollo/cache';
import {
  dropDeviceUnitSystem,
  dropUnitSystemAnswers,
  reconcileSettingsReplay,
} from '#/apollo/utils/unitSystemAnswers';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { UnitSystem } from '#/graphql/generated/schemaTypes';

const rootFields = (cache: ReturnType<typeof makeCache>) =>
  Object.keys(cache.extract().ROOT_QUERY ?? {});

describe('dropUnitSystemAnswers', () => {
  it('drops both pickers, so each is asked again in the new system', () => {
    const cache = makeCache();
    cache.restore({
      ROOT_QUERY: {
        __typename: 'Query',
        'consumptionUnitsForPantryItem({"pantryItemId":"p1"})': [],
        'restockUnitsForPantryItem({"pantryItemId":"p1"})': [],
        me: null,
      },
    });

    dropUnitSystemAnswers(cache);

    expect(rootFields(cache)).toEqual(['__typename', 'me']);
  });
});

describe('reconcileSettingsReplay', () => {
  const replay = (input: Record<string, unknown>) => {
    const cache = makeCache();
    cache.restore({
      ROOT_QUERY: {
        __typename: 'Query',
        'consumptionUnitsForPantryItem({"pantryItemId":"p1"})': [],
      },
    });
    reconcileSettingsReplay(cache, { input }, null);
    return rootFields(cache);
  };

  it('drops the pickers when the replayed write set the unit system', () => {
    expect(replay({ regional: { preferredUnitSystem: 'IMPERIAL' } })).toEqual([
      '__typename',
    ]);
  });

  it('keeps them for a settings write that left the unit system alone', () => {
    expect(replay({ regional: { language: 'es' } })).toContain(
      'consumptionUnitsForPantryItem({"pantryItemId":"p1"})',
    );
    expect(replay({ ui: { theme: 'DARK' } })).toContain(
      'consumptionUnitsForPantryItem({"pantryItemId":"p1"})',
    );
  });
});

describe('dropDeviceUnitSystem', () => {
  it('drops what SYSTEM meant on the device, so the settings read asks again', () => {
    const cache = makeCache();
    cache.writeQuery({
      query: GetUserSettingsDocument,
      data: {
        __typename: 'Query',
        me: {
          __typename: 'User',
          id: 'user-1',
          settings: {
            __typename: 'UserSettings',
            id: 'settings-1',
            theme: 'SYSTEM',
            compactMode: false,
            showTutorials: true,
            autoSync: true,
            offlineMode: false,
            shareUsageData: false,
            shareWithPartners: false,
            personalizedAds: false,
            preferredUnitSystem: UnitSystem.System,
            deviceUnitSystem: UnitSystem.Imperial,
            language: 'en-US',
            timezone: 'America/New_York',
            preferredCurrency: 'USD',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      } as never,
    });

    dropDeviceUnitSystem(cache);

    const settings = cache.extract()['UserSettings:settings-1'];
    expect(settings).toMatchObject({ preferredUnitSystem: UnitSystem.System });
    expect(settings).not.toHaveProperty('deviceUnitSystem');
  });

  it('does nothing before the settings have been read', () => {
    const cache = makeCache();
    expect(() => dropDeviceUnitSystem(cache)).not.toThrow();
  });
});
