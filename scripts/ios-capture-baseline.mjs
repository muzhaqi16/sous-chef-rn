#!/usr/bin/env node
/**
 * Capture an iOS cold-start baseline: n launches, one metric set each.
 *
 * Drives the app with `xcrun simctl launch` rather than through Detox, and that
 * choice is the point. Measured 2026-08-25 on one build, one device, warm cache,
 * varying ONLY the driver: Detox inflates `app_content_appeared_ms` 2.53x
 * (333 ms -> 843 ms) and `app_native_launch_ms` 1.73x, because it attaches its
 * own instrumentation and launches through XCUITest, and that cost lands in the
 * pre-JS window. `app_startup_duration_ms` is the one metric that does not move,
 * being measured from JS-bundle entry, downstream of everything Detox adds.
 *
 * So: cold-start numbers come from here. Per-screen metrics come from a Detox
 * run (`E2E_TELEMETRY=1 npm run test:e2e:release`), which is the only thing that
 * deterministically visits every surface. Never put the two in one table.
 *
 * Reads each launch's values back out of Mimir instead of the app, because the
 * transport's accumulators are per-process: every cold start is a new process,
 * so `_count` is 1 and `_sum` IS that launch's single observation. This is also
 * why the numbers must be read per session and never aggregated across launches.
 *
 * Usage:
 *   node scripts/ios-capture-baseline.mjs [--runs 5] [--device "iPhone 17"]
 *                                         [--items 63] [--label warm-cache]
 *                                         [--mimir http://host:9009]
 *
 * The collector to query defaults to $MIMIR_URL, then localhost:9009. Point it
 * at wherever your Mimir actually is.
 *
 * Prerequisites, none of which this script creates:
 *   - a RELEASE build installed and SIGNED IN (see docs/audits/perf-ios-baseline-2026-08-25.md)
 *   - tutorials already dismissed — a SpotlightCoachMark mounts inside the
 *     measured window and its state persists once skipped
 *   - the local API and the OTLP collector up
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : d;
};

const RUNS = Number(arg('runs', '5'));
const DEVICE = arg('device', 'iPhone 17');
const BUNDLE = arg('bundle', 'dev.souschef.app');
const ITEMS = arg('items', 'unrecorded');
const LABEL = arg('label', 'warm-cache');
// Where to READ the metrics back from. Not derived from OTLP_METRICS_ENDPOINT:
// that is the write path (`<base>/otlp` + `/v1/metrics`), while queries go to
// `<base>/prometheus/api/v1/...` — same host, different path, so deriving one
// from the other would only look right.
const MIMIR = arg('mimir', process.env.MIMIR_URL ?? 'http://localhost:9009');

const METRICS = [
  'app_native_launch_ms',
  'app_js_bundle_load_ms',
  'app_content_appeared_ms',
  'app_js_entry_to_store_ready_ms',
  'app_apollo_restore_ms',
  'app_startup_duration_ms',
  'app_fully_drawn_ms',
  'flashlist_initial_load_ms',
];

const sh = (c, a) => execFileSync(c, a, { encoding: 'utf8', stdio: 'pipe' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const promql = async query => {
  const url = `${MIMIR}/prometheus/api/v1/query?query=${encodeURIComponent(
    query,
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mimir ${res.status}`);
  return (await res.json()).data.result;
};

/**
 * The write time of a series' own sample.
 *
 * `timestamp()` and not a range query: Prometheus carries a series' last value
 * forward for five minutes, so a range query over a window containing the
 * PREVIOUS launch shows samples right through the current one and cannot tell
 * a fresh write from a stale carry-forward.
 */
const lastWriteSeconds = async metric => {
  const r = await promql(`timestamp(${metric}_count{platform="ios"})`);
  return r.length ? Math.max(...r.map(x => Number(x.value[1]))) : 0;
};

const median = xs => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2
    ? s[(s.length - 1) / 2]
    : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const runs = [];

for (let i = 1; i <= RUNS; i++) {
  const before = await lastWriteSeconds('app_content_appeared_ms');

  try {
    sh('xcrun', ['simctl', 'terminate', DEVICE, BUNDLE]);
  } catch {
    // Not running. Fine — that is the state we want.
  }
  await sleep(1500);
  sh('xcrun', ['simctl', 'launch', DEVICE, BUNDLE]);

  // Wait for THIS launch's flush, identified by a write newer than the one
  // standing before the launch — not by a fixed sleep, which would either race
  // the flush or pad every iteration.
  const deadline = Date.now() + 60_000;
  let fresh = false;
  while (Date.now() < deadline) {
    await sleep(2000);
    if ((await lastWriteSeconds('app_content_appeared_ms')) > before) {
      fresh = true;
      break;
    }
  }
  if (!fresh) {
    console.log(`run ${i}: no fresh sample within 60s — SKIPPED`);
    continue;
  }
  // One more flush interval, so slower metrics in the same session land too.
  await sleep(7000);

  const row = { run: i };
  for (const m of METRICS) {
    const r = await promql(`{__name__="${m}_sum", platform="ios"}`);
    // A metric can carry several label sets (flashlist reports per list), and
    // a launch that never rendered a list emits no app_fully_drawn_ms at all.
    row[m] = r.length
      ? Math.round(Math.max(...r.map(x => Number(x.value[1]))))
      : null;
  }
  runs.push(row);
  console.log(
    `run ${i}: fully_drawn=${row.app_fully_drawn_ms} ` +
      `content_appeared=${row.app_content_appeared_ms} ` +
      `native=${row.app_native_launch_ms}`,
  );
}

if (!runs.length) {
  console.error('No runs captured.');
  process.exit(1);
}

console.log(
  `\n${LABEL} · ${runs.length} launches · ${ITEMS} pantry items · ${DEVICE}\n`,
);
console.log(
  `${'metric'.padEnd(32)} ${'median'.padStart(7)} ${'min'.padStart(
    6,
  )} ${'max'.padStart(6)}  n`,
);
const summary = {};
for (const m of METRICS) {
  const vs = runs.map(r => r[m]).filter(v => v !== null);
  if (!vs.length) {
    console.log(
      `${m.padEnd(32)} ${'—'.padStart(7)} ${'—'.padStart(6)} ${'—'.padStart(
        6,
      )}  0`,
    );
    continue;
  }
  summary[m] = {
    median: median(vs),
    min: Math.min(...vs),
    max: Math.max(...vs),
    n: vs.length,
  };
  console.log(
    `${m.padEnd(32)} ${String(median(vs)).padStart(7)} ` +
      `${String(Math.min(...vs)).padStart(6)} ${String(
        Math.max(...vs),
      ).padStart(6)}  ${vs.length}`,
  );
}

const out = 'e2e/artifacts/ios-baseline.json';
writeFileSync(
  out,
  JSON.stringify(
    { label: LABEL, device: DEVICE, items: ITEMS, runs, summary },
    null,
    2,
  ),
);
console.log(`\nRaw per-run values -> ${out}`);
console.log('Read these per session; never aggregate across launches.');
