import type { PlatformServices } from './ports';

/**
 * A core module asked for a platform service the host has not installed:
 * before `installPlatform()` ran, or one the install left out.
 */
export class PlatformServiceMissing extends Error {
  constructor(readonly service: string, readonly installed = false) {
    super(
      installed
        ? `Platform service "${service}" is missing from installPlatform(). ` +
            'The host supplies every service the core reads.'
        : `Platform service "${service}" was read before installPlatform(). ` +
            'The host installs its services before the core runs.',
    );
    this.name = 'PlatformServiceMissing';
  }
}

// On `globalThis`, not in a module variable: a test that resets the module
// registry re-evaluates this file, and the install must outlive that.
const INSTALLED = Symbol.for('sous-chef.platform');

// Partial: a host written in JavaScript can leave a service out.
type Registry = { [INSTALLED]?: Partial<PlatformServices> };
const registry = globalThis as Registry;

/**
 * Installs the host's services, once, before the core runs. A
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

/**
 * One installed service, read where it is used, never while a module loads.
 * Throws `PlatformServiceMissing` before the install or for a service the
 * install left out.
 */
export function requirePlatform<Name extends keyof PlatformServices>(
  name: Name,
): PlatformServices[Name] {
  const services = registry[INSTALLED];
  if (!services) throw new PlatformServiceMissing(name);
  const service = services[name];
  if (!service) throw new PlatformServiceMissing(name, true);
  return service;
}
