import type { PlatformServices } from './ports';

/** A core module asked for a platform service before the host installed it. */
export class PlatformServiceMissing extends Error {
  constructor(readonly service: string) {
    super(
      `Platform service "${service}" was read before installPlatform(). ` +
        'The host installs it before any core module evaluates.',
    );
    this.name = 'PlatformServiceMissing';
  }
}

// On `globalThis`, not in a module variable: a test that resets the module
// registry re-evaluates this file, and the install must outlive that.
const INSTALLED = Symbol.for('sous-chef.platform');

type Registry = { [INSTALLED]?: PlatformServices };
const registry = globalThis as Registry;

/**
 * Installs the host's services, once, before any core module evaluates. A
 * second install throws in development: a module may already hold the first
 * set, so two would split the app between them.
 */
export function installPlatform(services: PlatformServices): void {
  if (registry[INSTALLED]) {
    if (__DEV__) {
      throw new Error('installPlatform() was called twice.');
    }
    return;
  }
  registry[INSTALLED] = services;
}

/** One installed service; throws `PlatformServiceMissing` before the install. */
export function requirePlatform<Name extends keyof PlatformServices>(
  name: Name,
): PlatformServices[Name] {
  const services = registry[INSTALLED];
  if (!services) throw new PlatformServiceMissing(name);
  return services[name];
}
