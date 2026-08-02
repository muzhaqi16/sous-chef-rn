jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackScreen: <T>(config: T): T => config,
}));
jest.mock('../ProfileScreen', () => ({ ProfileScreen: () => null }));

import { expectDeclaresLinkingIntent } from '#/test-utils/screenRegistration';
import { profileScreens } from '../registration';

describe('profileScreens', () => {
  it('registers Profile and its settings screens', () => {
    expect(Object.keys(profileScreens).sort()).toEqual([
      'AppSettings',
      'Appearance',
      'ChangePassword',
      'DebugInfo',
      'DeleteAccount',
      'DietaryProfile',
      'ImageCrop',
      'NotificationSettings',
      'PerformanceDashboard',
      'PersonalInformation',
      'Profile',
      'ProfilePhotoUpload',
    ]);
  });

  // These three were deep-linkable before the screens moved out of
  // RootNavigator; the paths must survive the move.
  it('keeps the deep-link paths that already shipped', () => {
    expect(profileScreens.ProfilePhotoUpload.linking).toBe('upload-photo');
    expect(profileScreens.ImageCrop.linking).toBe('crop-image');
    expect(profileScreens.DeleteAccount.linking).toBe('delete-account');
  });

  it('every screen declares an explicit linking intent', () => {
    expectDeclaresLinkingIntent(profileScreens);
  });
});
