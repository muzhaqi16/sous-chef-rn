import type { ApolloCache } from '@apollo/client';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { AppTheme, UnitSystem } from '#/graphql/generated/schemaTypes';
import type { QueryDataFor } from '../apolloMockProvider';

type Settings = NonNullable<
  NonNullable<QueryDataFor<typeof GetUserSettingsDocument>['me']>['settings']
>;

/**
 * Seeds `GetUserSettings` with the whole selection, so a settings reader
 * answers from the cache with no request. Writing it again changes a setting.
 */
export function writeUserSettings(
  cache: ApolloCache,
  overrides: Partial<Omit<Settings, '__typename' | 'id'>> = {},
) {
  const data: QueryDataFor<typeof GetUserSettingsDocument> = {
    __typename: 'Query',
    me: {
      __typename: 'User',
      id: 'user-1',
      settings: {
        __typename: 'UserSettings',
        id: 'settings-1',
        theme: AppTheme.System,
        compactMode: false,
        showTutorials: true,
        autoSync: true,
        offlineMode: false,
        shareUsageData: false,
        shareWithPartners: false,
        personalizedAds: false,
        preferredUnitSystem: UnitSystem.System,
        deviceUnitSystem: UnitSystem.Metric,
        language: 'en-US',
        timezone: 'America/New_York',
        preferredCurrency: 'USD',
        storeMode: true,
        budgetAndPrices: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
      },
    },
  };
  cache.writeQuery({ query: GetUserSettingsDocument, data });
}

/** `writeUserSettings` with a unit system, for `useReadingSystem`. */
export function writeUnitSystemSettings(
  cache: ApolloCache,
  preferredUnitSystem: UnitSystem,
  deviceUnitSystem: UnitSystem,
) {
  writeUserSettings(cache, { preferredUnitSystem, deviceUnitSystem });
}
