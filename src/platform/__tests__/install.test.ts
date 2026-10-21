import {
  installPlatform,
  PlatformServiceMissing,
  requirePlatform,
} from '../install';
import type { PlatformServices } from '../ports';

// The registry jest.setup.js filled; each test starts without it.
const INSTALLED = Symbol.for('sous-chef.platform');
const registry = globalThis as { [INSTALLED]?: PlatformServices };
const setupInstall = registry[INSTALLED];

beforeEach(() => {
  delete registry[INSTALLED];
});

afterAll(() => {
  registry[INSTALLED] = setupInstall;
});

const asServices = (partial: Partial<PlatformServices>) =>
  partial as PlatformServices;
const environment = { API_URL: 'https://api.test' };

describe('installPlatform', () => {
  it('names the service read before the install', () => {
    let thrown: unknown;
    try {
      requirePlatform('keyValueStore');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PlatformServiceMissing);
    expect(thrown).toMatchObject({
      name: 'PlatformServiceMissing',
      service: 'keyValueStore',
    });
    expect((thrown as Error).message).toContain('"keyValueStore"');
  });

  it('names a service the install left out', () => {
    installPlatform(asServices({ environment }));

    expect(() => requirePlatform('keyValueStore')).toThrow(
      PlatformServiceMissing,
    );
    expect(() => requirePlatform('keyValueStore')).toThrow(
      'Platform service "keyValueStore" is missing from installPlatform().',
    );
  });

  it('returns the installed service', () => {
    installPlatform(asServices({ environment }));

    expect(requirePlatform('environment')).toBe(environment);
  });

  it('refuses a second install in development and keeps the first', () => {
    installPlatform(asServices({ environment }));

    expect(() =>
      installPlatform(asServices({ environment: { API_URL: 'other' } })),
    ).toThrow('installPlatform() was called twice.');
    expect(requirePlatform('environment')).toBe(environment);
  });

  it('keeps the install across a module registry reset', () => {
    installPlatform(asServices({ environment }));

    jest.isolateModules(() => {
      const reloaded = require('../install') as typeof import('../install');
      expect(reloaded.requirePlatform('environment')).toBe(environment);
    });
  });
});
