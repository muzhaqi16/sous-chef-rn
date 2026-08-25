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

const now = (): number => {
  const perf = (globalThis as { performance?: { now?: () => number } })
    .performance;
  return perf?.now ? perf.now() : Date.now();
};

export function instrumentViewManagerConstants(): void {
  const original = global.RN$LegacyInterop_UIManager_getConstantsForViewManager;
  if (typeof original !== 'function') return;

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
 * Whether the probe observed anything at all.
 *
 * False on iOS, always: the wrapped global is installed only when
 * `useNativeViewConfigsInBridgelessMode()` is true (`RCTInstance.mm`), and that
 * flag defaults to false, so `instrumentViewManagerConstants` returns at its
 * `typeof original !== 'function'` guard. Callers use this to skip WRITING the
 * report rather than writing an empty one — an artifact that exists and says
 * zero reads as "measured, found nothing", which is the opposite of the truth.
 * iOS does not take this code path at all; view configs come from the static
 * native component registry.
 */
export function hasViewManagerRecords(): boolean {
  return records.length > 0;
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
    { totalMs: total, count: records.length, rows },
    null,
    2,
  );
}
