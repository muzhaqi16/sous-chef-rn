import { requirePlatform } from '#platform/install';
import type { Env } from '#platform/ports';

const installed = (): Env => requirePlatform('environment');

/**
 * Build-time configuration, from the host's `environment` service. Every value
 * is a string or unset; consumers apply their own parsing.
 *
 * Read on access, not at import: the startup clock and profiler load before the
 * host installs its services, and what they import (the logger among it) may
 * import this. Reading a value before the install throws `PlatformServiceMissing`.
 */
export const env: Env = new Proxy<Env>(
  {},
  {
    get: (_target, key): unknown => Reflect.get(installed(), key),
    has: (_target, key) => Reflect.has(installed(), key),
    ownKeys: () => Reflect.ownKeys(installed()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(installed(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  },
);
