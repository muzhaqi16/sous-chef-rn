/**
 * The platform gates in `StartupMark` are exercised by nothing else:
 * `NativePerformanceService.test.ts` mocks this module wholesale, so before
 * this file existed the shim could have no-opped on every platform and every
 * test would still have passed.
 *
 * What it pins is the asymmetry. `reportFullyDrawn` is Android-only because iOS
 * has no API to call. The three profiling methods are on BOTH platforms and
 * gate on the method existing, not on `Platform.OS` — the bug this guards
 * against is someone restoring an `=== 'android'` check there, which would
 * silently give iOS neither a Hermes profile nor a view-manager report while
 * the build stayed green.
 */
type StartupMarkModule = typeof import('../StartupMark').StartupMark;

/** The real iOS surface: profiling methods, no `reportFullyDrawn`. */
const iosNativeModule = () => ({
  startProfiling: jest.fn(),
  stopProfiling: jest.fn().mockResolvedValue('/Documents/startup.cpuprofile'),
  writeTextFile: jest.fn().mockResolvedValue('/Documents/viewmanagers.json'),
});

/** The real Android surface: the same three, plus the OS marker. */
const androidNativeModule = () => ({
  ...iosNativeModule(),
  reportFullyDrawn: jest.fn(),
});

/**
 * `jest.resetModules()` rather than `jest.isolateModules()`, deliberately.
 *
 * React Native's index exports `Platform` through a lazy getter that `require`s
 * the module on every access, and Babel's ESM interop compiles the import here
 * to that same live read. So the `Platform.OS` check runs its `require` when
 * the method is CALLED, not when the module is imported — and once an
 * `isolateModules` callback returns, that require resolves against the restored
 * OUTER registry, handing back the untouched `Platform` with `OS === 'ios'`.
 * The stub, destructured out of `NativeModules` at import time, is retained
 * either way, so the failure is silent and one-sided: the profiling assertions
 * pass and only the `Platform`-gated one fails.
 *
 * Keeping the mutated registry live for the duration of the test avoids it.
 */
const load = (
  os: 'ios' | 'android',
  native: Record<string, unknown> | null,
): StartupMarkModule => {
  jest.resetModules();
  const rn = require('react-native');
  Object.defineProperty(rn.Platform, 'OS', {
    value: os,
    writable: true,
    configurable: true,
  });
  if (native) {
    rn.NativeModules.StartupMarkModule = native;
  } else {
    delete rn.NativeModules.StartupMarkModule;
  }
  return require('../StartupMark').StartupMark;
};

describe('StartupMark', () => {
  describe('reportFullyDrawn — Android only', () => {
    it('calls the native marker on Android', () => {
      const native = androidNativeModule();
      const mark = load('android', native);

      mark.reportFullyDrawn();

      expect(native.reportFullyDrawn).toHaveBeenCalledTimes(1);
    });

    it('does nothing on iOS, where the native module has no such method', () => {
      const native = iosNativeModule();
      const mark = load('ios', native);

      expect(() => mark.reportFullyDrawn()).not.toThrow();
      expect(native.startProfiling).not.toHaveBeenCalled();
    });
  });

  describe.each(['ios', 'android'] as const)('profiling on %s', os => {
    it('starts the Hermes profiler through the native module', () => {
      const native = os === 'ios' ? iosNativeModule() : androidNativeModule();
      const mark = load(os, native);

      mark.startProfiling();

      expect(native.startProfiling).toHaveBeenCalledTimes(1);
    });

    it('resolves stopProfiling with the path the native side wrote', async () => {
      const native = os === 'ios' ? iosNativeModule() : androidNativeModule();
      const mark = load(os, native);

      await expect(mark.stopProfiling('startup.cpuprofile')).resolves.toBe(
        '/Documents/startup.cpuprofile',
      );
      expect(native.stopProfiling).toHaveBeenCalledWith('startup.cpuprofile');
    });

    it('resolves writeTextFile with the path the native side wrote', async () => {
      const native = os === 'ios' ? iosNativeModule() : androidNativeModule();
      const mark = load(os, native);

      await expect(
        mark.writeTextFile('viewmanagers.json', '{"rows":[]}'),
      ).resolves.toBe('/Documents/viewmanagers.json');
      expect(native.writeTextFile).toHaveBeenCalledWith(
        'viewmanagers.json',
        '{"rows":[]}',
      );
    });
  });

  describe('with the native module absent', () => {
    it('no-ops rather than throwing, and resolves null', async () => {
      const mark = load('ios', null);

      expect(() => mark.reportFullyDrawn()).not.toThrow();
      expect(() => mark.startProfiling()).not.toThrow();
      await expect(
        mark.stopProfiling('startup.cpuprofile'),
      ).resolves.toBeNull();
      await expect(mark.writeTextFile('x.json', '{}')).resolves.toBeNull();
    });
  });
});

/**
 * Import with the registry EMPTY, then populate it — the ordering `index.js`
 * actually produces, since it imports this module in its first few lines.
 */
const loadThenProvide = (
  os: 'ios' | 'android',
): {
  mark: StartupMarkModule;
  provide: (native: Record<string, unknown>) => void;
} => {
  jest.resetModules();
  const rn = require('react-native');
  Object.defineProperty(rn.Platform, 'OS', {
    value: os,
    writable: true,
    configurable: true,
  });
  delete rn.NativeModules.StartupMarkModule;
  return {
    mark: require('../StartupMark').StartupMark,
    provide: (native: Record<string, unknown>) => {
      rn.NativeModules.StartupMarkModule = native;
    },
  };
};

describe('StartupMark — native module resolution', () => {
  it('resolves the module at call time, not at import time', () => {
    // A module-scope `const { StartupMarkModule } = NativeModules` freezes in
    // whatever the registry held at import; an `undefined` captured then makes
    // every method a permanent silent no-op for the process.
    const { mark, provide } = loadThenProvide('android');
    const reportFullyDrawn = jest.fn();

    provide({ reportFullyDrawn });
    mark.reportFullyDrawn();

    expect(reportFullyDrawn).toHaveBeenCalledTimes(1);
  });
});

describe('StartupMark — whether the profiler armed', () => {
  it.each(['ios', 'android'] as const)(
    'reports true on %s when the native module armed it',
    os => {
      const mark = load(
        os,
        os === 'ios' ? iosNativeModule() : androidNativeModule(),
      );

      expect(mark.startProfiling()).toBe(true);
    },
  );

  it('reports false when the module is absent, so the metric is not withheld', () => {
    // Suppressing `app_fully_drawn_ms` on the build flag alone left a flagged
    // build with neither a number nor a trace. The armed answer decides, not
    // the flag.
    const mark = load('ios', null);

    expect(mark.startProfiling()).toBe(false);
  });
});
