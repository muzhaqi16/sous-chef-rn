/**
 * Records which native view managers get their constants fetched, and how long
 * each fetch takes.
 *
 * A Hermes sample carries no arguments, so the CPU profile can prove that
 * `getConstantsForViewManager` is disproportionately expensive on device
 * (3.29x vs 1.75x for everything else) without naming a single component. This
 * closes that gap by timing each call by name.
 *
 * On the New Architecture the call routes through `BridgelessUIManager`, which
 * captures `global.RN$LegacyInterop_UIManager_getConstantsForViewManager` into
 * a module-scope const at evaluation time (its `:44`). So the wrap has to be
 * installed from `index.js`, before anything pulls that module in — which
 * `inlineRequires` defers until first use, giving us the window.
 *
 * Measurement-only, behind `HERMES_PROFILE_STARTUP`. Never on in a normal build.
 */
type CallRecord = { name: string; ms: number };

const records: CallRecord[] = [];

/**
 * Whether the probe found the interop global to wrap.
 *
 * Without this, "the probe never attached" and "no view manager was queried"
 * produce the SAME empty report — and an empty report reads as "this costs
 * nothing", which is the failure mode this whole measurement exists to avoid.
 */
let attached = false;

const now = (): number => {
  const perf = (globalThis as { performance?: { now?: () => number } })
    .performance;
  return perf?.now ? perf.now() : Date.now();
};

export function instrumentViewManagerConstants(): void {
  const original = global.RN$LegacyInterop_UIManager_getConstantsForViewManager;
  if (typeof original !== 'function') {
    // Left false on purpose: the report says it did not observe, rather than
    // reporting zero observations.
    attached = false;
    return;
  }
  attached = true;

  global.RN$LegacyInterop_UIManager_getConstantsForViewManager = (
    viewManagerName: string,
  ) => {
    const started = now();
    const result = original(viewManagerName);
    records.push({ name: viewManagerName, ms: now() - started });
    return result;
  };
}

/**
 * Whether the probe wrapped the interop global — the one condition that decides
 * whether the report is worth writing.
 *
 * False on iOS, always: the wrapped global is installed only when
 * `useNativeViewConfigsInBridgelessMode()` is true (`RCTInstance.mm`), and that
 * flag defaults to false, so `instrumentViewManagerConstants` returns at its
 * `typeof original !== 'function'` guard. iOS does not take this code path at
 * all; view configs come from the static native component registry.
 *
 * Gating the report on RECORDS instead made `attached: false` — the field the
 * report tells you to read FIRST — structurally unreachable: no attach means no
 * records, which meant no report at all, so "never attached" and "attached and
 * saw nothing" were indistinguishable. Both are real findings; only the second
 * means the interop path is free.
 */
export function didViewManagerProbeAttach(): boolean {
  return attached;
}

/** Per-view-manager totals, slowest first. */
export function summarizeViewManagerConstants(): string {
  const byName = new Map<string, { calls: number; ms: number }>();
  for (const entry of records) {
    const acc = byName.get(entry.name) ?? { calls: 0, ms: 0 };
    acc.calls += 1;
    acc.ms += entry.ms;
    byName.set(entry.name, acc);
  }
  const rows = [...byName.entries()]
    .map(([name, acc]) => ({ name, calls: acc.calls, ms: acc.ms }))
    .sort((a, b) => b.ms - a.ms);
  const total = rows.reduce((sum, row) => sum + row.ms, 0);
  return JSON.stringify(
    {
      // Read this FIRST. `attached: false` means the probe never wrapped the
      // interop global — the zeroes below are the absence of a measurement, not
      // a measurement of absence.
      attached,
      totalMs: total,
      count: records.length,
      rows,
    },
    null,
    2,
  );
}
