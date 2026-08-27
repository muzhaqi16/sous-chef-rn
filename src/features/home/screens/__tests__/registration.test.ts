jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackScreen: <T>(config: T): T => config,
}));
jest.mock('../HomeManagement', () => ({ HomeManagement: () => null }));
jest.mock('../HomeDetailScreen', () => ({ HomeDetailScreen: () => null }));
jest.mock('#features/catalog/screens/StorageLocationsScreen', () => ({
  StorageLocationsScreen: () => null,
}));

import { expectDeclaresLinkingIntent } from '#/test-utils/screenRegistration';
import { homeManagementScreens } from '../registration';

describe('homeManagementScreens', () => {
  it('registers every home management screen', () => {
    expect(Object.keys(homeManagementScreens).sort()).toEqual([
      'HomeDetail',
      'HomeManagement',
    ]);
  });

  it('keeps the HomeManagement deep-link path', () => {
    expect(homeManagementScreens.HomeManagement.linking).toBe(
      'home-management/:selectedHomeId?',
    );
  });

  it('every screen declares an explicit linking intent', () => {
    expectDeclaresLinkingIntent(homeManagementScreens);
  });
});
