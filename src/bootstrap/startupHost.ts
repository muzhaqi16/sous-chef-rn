import { errorService } from '#/services/errorService';

/**
 * What a host adds to start-up. The core starts the same under every host; a
 * host with a device behind it also restores what that device holds and
 * starts its services. A host with none of that registers nothing.
 */
export interface StartupHost {
  /**
   * First, once storage has hydrated: what must land before the core reads the
   * session. `telemetry: false` keeps this run's telemetry off.
   */
  beforeStart(): { telemetry?: boolean } | undefined;
  /** After the core's steps; the host's own services. */
  afterStart(): void;
  /** Properties the `app_launched` event carries, such as the active theme. */
  launchProperties(): Record<string, unknown>;
  /** When the root unmounts: stops what `afterStart` started. */
  stop(): void;
}

/** A host that adds nothing to start-up. */
export const NO_STARTUP_HOST: StartupHost = {
  beforeStart: () => undefined,
  afterStart: () => {},
  launchProperties: () => ({}),
  stop: () => {},
};

/**
 * Each step reported by name and settled as a host without it would, so no
 * host can stop the core's start-up — the same contract as `sessionHost`.
 * Module-level, where the React Compiler does not reach a try/catch.
 */
export function guardedStartupHost(host: StartupHost): StartupHost {
  const run = <T>(step: keyof StartupHost, fallback: T, call: () => T): T => {
    try {
      return call();
    } catch (error) {
      errorService.reportError(error, { operation: `startupHost.${step}` });
      return fallback;
    }
  };
  return {
    beforeStart: () => run('beforeStart', undefined, () => host.beforeStart()),
    afterStart: () => run('afterStart', undefined, () => host.afterStart()),
    launchProperties: () =>
      run('launchProperties', {}, () => host.launchProperties()),
    stop: () => run('stop', undefined, () => host.stop()),
  };
}
