import { waitFor } from '@testing-library/react-native';
import { changeLanguage, getResolvedLanguage } from '#/i18n';
import { useStore } from '#store';
import { memoryLifecycle } from '#/test-utils/memoryPlatform';
import { followDeviceLanguage } from '../followDeviceLanguage';

const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

/** The device's language as the app reads it. */
function deviceSetTo(language: string) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language },
  });
}

/** The user leaves for Settings and comes back. */
function returnFromSettings() {
  memoryLifecycle().moveTo('background');
  memoryLifecycle().moveTo('active');
}

describe('followDeviceLanguage', () => {
  let stop: () => void;

  beforeEach(async () => {
    await changeLanguage('en');
    deviceSetTo('en-US');
    useStore.setState({ language: undefined });
    stop = followDeviceLanguage();
  });

  afterEach(async () => {
    stop();
    if (realNavigator)
      Object.defineProperty(globalThis, 'navigator', realNavigator);
    useStore.setState({ language: undefined });
    await changeLanguage('en');
  });

  it("takes the device's new language on return when the user never picked one", async () => {
    deviceSetTo('it-IT');
    returnFromSettings();

    await waitFor(() => expect(getResolvedLanguage()).toBe('it'));
  });

  it('keeps the language the user picked', async () => {
    useStore.setState({ language: 'sq' });
    await changeLanguage('sq');
    deviceSetTo('it-IT');
    returnFromSettings();

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(getResolvedLanguage()).toBe('sq');
  });

  it("falls back to English for a device language the app doesn't ship", async () => {
    await changeLanguage('es');
    deviceSetTo('de-DE');
    returnFromSettings();

    await waitFor(() => expect(getResolvedLanguage()).toBe('en'));
  });

  it('changes nothing while the app is away', async () => {
    deviceSetTo('it-IT');
    memoryLifecycle().moveTo('background');

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(getResolvedLanguage()).toBe('en');
  });
});
