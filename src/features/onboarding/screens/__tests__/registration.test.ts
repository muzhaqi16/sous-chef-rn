jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackScreen: <T>(config: T): T => config,
}));

import { expectDeclaresLinkingIntent } from '#/test-utils/screenRegistration';
import { StorePickerScreen } from '#features/catalog/screens/StorePickerScreen';
import { onboardingScreens } from '../registration';

describe('onboardingScreens', () => {
  it("opens the catalog's store picker, adding several stores in one visit", () => {
    expect(onboardingScreens.OnboardingStores).toMatchObject({
      screen: StorePickerScreen,
      initialParams: { several: true },
      linking: null,
    });
  });

  it('every screen declares an explicit linking intent', () => {
    expectDeclaresLinkingIntent(onboardingScreens);
  });
});
