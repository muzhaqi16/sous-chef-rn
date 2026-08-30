/**
 * Times each `getConstantsForViewManager` call by name — a Hermes sample carries
 * no arguments, so the profile alone cannot name callers. Measurement-only,
 * behind `HERMES_PROFILE_STARTUP`. The wrap must be installed from `index.js`
 * before `BridgelessUIManager` captures the interop global at evaluation time.
 */
type CallRecord = { name: string; ms: number };

const records: CallRecord[] = [];

/**
 * Without this, "never attached" and "nothing was queried" produce the SAME
 * empty report — which reads as "this costs nothing".
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
    // Left false on purpose: "did not observe" is not "observed zero".
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
 * Decides whether the report is worth writing. Always false on iOS: the interop
 * global exists only when `useNativeViewConfigsInBridgelessMode()` is true
 * (`RCTInstance.mm`, default false), so iOS never takes this path — its view
 * configs come from the static native component registry.
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
      // Read FIRST: `attached: false` makes the zeroes below the absence of a
      // measurement, not a measurement of absence.
      attached,
      totalMs: total,
      count: records.length,
      rows,
    },
    null,
    2,
  );
}
