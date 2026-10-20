import { Alert } from 'react-native';

jest.unmock('#/services/alertService');

const INSTALLED = Symbol.for('sous-chef.platform');
const registry = globalThis as { [INSTALLED]?: unknown };
const setupInstall = registry[INSTALLED];

afterEach(() => {
  registry[INSTALLED] = setupInstall;
});

/** A fresh launch: the composition root runs with nothing installed yet. */
const launch = (): typeof import('#/services/alertService') => {
  delete registry[INSTALLED];
  let alerts!: typeof import('#/services/alertService');
  jest.isolateModules(() => {
    require('../installNativePlatform');
    alerts = require('#/services/alertService');
  });
  return alerts;
};

describe('installNativePlatform', () => {
  it('installs the platform', () => {
    launch();

    expect(registry[INSTALLED]).toEqual(
      expect.objectContaining({
        keyValueStore: expect.any(Object),
        secureStore: expect.any(Object),
        appearance: expect.any(Object),
      }),
    );
  });

  it('shows an alert raised before the dialog host mounts as the OS alert', () => {
    const osAlert = jest.spyOn(Alert, 'alert').mockImplementation();
    const onPress = jest.fn();
    const { alertService } = launch();

    alertService.alert('Sync failed', 'Try again later', [
      { text: 'Retry', style: 'default', onPress },
    ]);

    expect(osAlert).toHaveBeenCalledWith('Sync failed', 'Try again later', [
      { text: 'Retry', style: 'default', onPress },
    ]);
    osAlert.mockRestore();
  });
});
