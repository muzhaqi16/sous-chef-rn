import type { PlatformServices } from '#platform/ports';

const INSTALLED = Symbol.for('sous-chef.platform');
const registry = globalThis as { [INSTALLED]?: PlatformServices };
const setupInstall = registry[INSTALLED];

afterEach(() => {
  registry[INSTALLED] = setupInstall;
});

const freshEnv = (): typeof import('../env') => {
  let loaded!: typeof import('../env');
  jest.isolateModules(() => {
    loaded = require('../env');
  });
  return loaded;
};

describe('env', () => {
  it('can be imported before the host installs its services', () => {
    delete registry[INSTALLED];

    expect(freshEnv).not.toThrow();
  });

  it('names the missing service when read before the install', () => {
    delete registry[INSTALLED];
    const { env } = freshEnv();

    expect(() => env.API_URL).toThrow('Platform service "environment"');
  });

  it('reads the installed values on access', () => {
    registry[INSTALLED] = {
      ...setupInstall,
      environment: { API_URL: 'https://api.test/graphql' },
    } as PlatformServices;
    const { env } = freshEnv();

    expect(env.API_URL).toBe('https://api.test/graphql');
    expect('API_URL' in env).toBe(true);
    expect('WEB_SOCKET_URL' in env).toBe(false);
    expect(Object.keys(env)).toEqual(['API_URL']);
  });
});
