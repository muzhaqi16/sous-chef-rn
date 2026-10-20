/**
 * The install module, evaluated the way an eager bundler evaluates it: every
 * import first, with nothing installed. Metro's inline requires defer most of
 * them, which is how a read during that evaluation went unseen. The setup's
 * telemetry and environment mocks would cut the chain the install's own
 * adapters reach (keychain → errorService → telemetry → deviceId), so they are
 * the real modules here.
 */
jest.unmock('#/services/telemetry');
jest.unmock('#/utils/environment');

const INSTALLED = Symbol.for('sous-chef.platform');
const registry = globalThis as { [INSTALLED]?: unknown };
const setupInstall = registry[INSTALLED];

afterEach(() => {
  registry[INSTALLED] = setupInstall;
});

it('installs the platform with every import evaluated first', () => {
  delete registry[INSTALLED];

  expect(() =>
    jest.isolateModules(() => {
      require('../installNativePlatform');
    }),
  ).not.toThrow();
  expect(registry[INSTALLED]).toEqual(
    expect.objectContaining({
      environment: expect.any(Object),
      secureStore: expect.any(Object),
      platformInfo: expect.any(Object),
    }),
  );
});
