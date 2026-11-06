import { zustandStorage } from '#/store/deviceStorage';
import {
  storedResumableStep,
  useOnboardingProgressStore,
  useOnboardingSetupStore,
} from '../onboardingProgressStore';

const KEY = 'sous-chef-onboarding-progress';

describe('onboarding progress on the device', () => {
  it('keeps the furthest question when setup starts before it has loaded', async () => {
    await zustandStorage.setItem(
      KEY,
      JSON.stringify({
        state: {
          cooksFor: 2,
          dietarySaved: true,
          receiptItems: 0,
          stapleItems: 0,
          reachedStep: 'Receipt',
        },
        version: 1,
      }),
    );
    const setItem = jest.spyOn(zustandStorage, 'setItem');

    // Setup starts as the app opens, before the stored progress is read.
    useOnboardingSetupStore
      .getState()
      .setSetupStatus({ kind: 'running', createMissingHome: true });
    await useOnboardingProgressStore.persist.rehydrate();

    expect(setItem).not.toHaveBeenCalledWith(KEY, expect.anything());
    expect(await storedResumableStep()).toBe('Receipt');
    setItem.mockRestore();
  });
});
