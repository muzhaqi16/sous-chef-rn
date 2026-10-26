import type { ApolloCache } from '@apollo/client';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { AppTheme, type UnitSystem } from '#/graphql/generated/schemaTypes';
import type { QueryDataFor } from '../apolloMockProvider';

/**
 * Seeds `GetUserSettings` with the whole selection, so `useReadingSystem`
 * answers from the cache with no request. Writing it again switches the setting.
 */
export function writeUnitSystemSettings(
  cache: ApolloCache,
  preferredUnitSystem: UnitSystem,
  deviceUnitSystem: UnitSystem,
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
        preferredUnitSystem,
        deviceUnitSystem,
        language: 'en-US',
        timezone: 'America/New_York',
        preferredCurrency: 'USD',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  };
  cache.writeQuery({ query: GetUserSettingsDocument, data });
}
