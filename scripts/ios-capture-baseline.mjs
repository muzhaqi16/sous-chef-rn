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
 *   - a RELEASE build installed and SIGNED IN. A debug build overstates mount
 *     cost, and a signed-out launch never renders a list, so it produces no
 *     `app_fully_drawn_ms` at all
 *   - tutorials already dismissed — a SpotlightCoachMark mounts inside the
 *     measured window and its state persists once skipped
 *   - the local API and the OTLP collector up
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { median, parseFlags, sh } from './lib/tooling.mjs';

const flags = parseFlags({
  runs: { type: 'string', default: '5' },
  device: { type: 'string', default: 'iPhone 17' },
  bundle: { type: 'string', default: 'dev.souschef.app' },
  items: { type: 'string', default: 'unrecorded' },
  label: { type: 'string', default: 'warm-cache' },
  mimir: { type: 'string' },
  'self-test': { type: 'boolean', default: false },
});

const RUNS = Number(flags.runs);
const DEVICE = flags.device;
const BUNDLE = flags.bundle;
const ITEMS = flags.items;
const LABEL = flags.label;
// Where to READ the metrics back from. Not derived from OTLP_METRICS_ENDPOINT:
// that is the write path (`<base>/otlp` + `/v1/metrics`), while queries go to
// `<base>/prometheus/api/v1/...` — same host, different path, so deriving one
// from the other would only look right.
const MIMIR = flags.mimir ?? process.env.MIMIR_URL ?? 'http://localhost:9009';

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

const sleep = ms => new Promise(r => setTimeout(r, ms));

let promql = async query => {
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

/** Identify a series by its labels, so a value can be paired with its write time. */
const seriesKey = labels => {
  const { __name__, ...rest } = labels;
  return JSON.stringify(Object.entries(rest).sort());
};

/**
 * This launch's value for a metric, or `null` if this launch did not produce
 * one.
 *
 * Every series is checked against its OWN write time, because the five-minute
 * carry-forward `lastWriteSeconds` exists to defeat applies to value reads too:
 * runs here are 10-30 s apart, so a run that emits no `app_fully_drawn_ms`
 * still gets the previous run's sample back from a plain query. Reading that as
 * this run's value made the series silently non-decreasing across runs and fed
 * the summary cross-launch maxima — the aggregation this file's own footer
 * forbids.
 *
 * Several fresh series is legitimate for per-component metrics
 * (`flashlist_initial_load_ms` reports one per list), and the max across them
 * is the slowest list in THIS launch. Several fresh series on a metric that
 * should have one is a labelling change worth seeing, so it is reported.
 */
const readFreshMetric = async (metric, beforeSeconds) => {
  const [values, writes] = await Promise.all([
    promql(`{__name__="${metric}_sum", platform="ios"}`),
    promql(`timestamp(${metric}_sum{platform="ios"})`),
  ]);

  const writtenAt = new Map(
    writes.map(x => [seriesKey(x.metric), Number(x.value[1])]),
  );

  const fresh = values.filter(x => {
    const ts = writtenAt.get(seriesKey(x.metric));
    return ts !== undefined && ts > beforeSeconds;
  });

  if (!fresh.length) return { value: null, series: 0, stale: values.length };
  return {
    value: Math.round(Math.max(...fresh.map(x => Number(x.value[1])))),
    series: fresh.length,
    stale: values.length - fresh.length,
  };
};

// --- self-test -------------------------------------------------------------
// The freshness gate decides whether a recorded number belongs to the launch it
// is filed under, and it is only ever exercised against a live Mimir — where a
// stale carry-forward and a fresh sample look identical in the output. This
// drives `readFreshMetric` against a stubbed query layer instead.
//
//   node scripts/ios-capture-baseline.mjs --self-test
if (flags['self-test']) {
  const stub = (values, writes) => {
    promql = async query => (query.startsWith('timestamp(') ? writes : values);
  };
  const series = (labels, value) => ({
    metric: labels,
    value: [0, String(value)],
  });
  const failures = [];

  // A launch that emitted nothing: the value query still answers, because
  // Prometheus carries the previous launch's sample forward for five minutes.
  stub(
    [series({ __name__: 'app_fully_drawn_ms_sum', platform: 'ios' }, 2100)],
    [series({ __name__: 'app_fully_drawn_ms_sum', platform: 'ios' }, 1000)],
  );
  const stale = await readFreshMetric('app_fully_drawn_ms', 1000);
  if (stale.value !== null) {
    failures.push(
      `A carried-forward sample was read as this launch's value (${stale.value}).`,
    );
  }
  if (stale.stale !== 1) {
    failures.push(`Stale series were not counted (got ${stale.stale}).`);
  }

  // The same shape, written after the baseline: that IS this launch's value.
  stub(
    [series({ __name__: 'app_fully_drawn_ms_sum', platform: 'ios' }, 2100)],
    [series({ __name__: 'app_fully_drawn_ms_sum', platform: 'ios' }, 1500)],
  );
  const fresh = await readFreshMetric('app_fully_drawn_ms', 1000);
  if (fresh.value !== 2100) {
    failures.push(`A fresh sample was not read (got ${fresh.value}).`);
  }

  // Per-component metric: max across the FRESH series only, so a stale slow
  // list cannot inflate a later launch.
  stub(
    [
      series({ __name__: 'x_sum', platform: 'ios', component: 'A' }, 900),
      series({ __name__: 'x_sum', platform: 'ios', component: 'B' }, 300),
    ],
    [
      series({ __name__: 'x_sum', platform: 'ios', component: 'A' }, 500),
      series({ __name__: 'x_sum', platform: 'ios', component: 'B' }, 1500),
    ],
  );
  const mixed = await readFreshMetric('x', 1000);
  if (mixed.value !== 300 || mixed.series !== 1) {
    failures.push(
      `Stale series leaked into a multi-series read (value=${mixed.value}, ` +
        `fresh=${mixed.series}).`,
    );
  }

  if (failures.length) {
    console.error(
      '\n\u2717 Self-test failed:\n\n' + failures.map(f => `  ${f}`).join('\n'),
    );
    process.exit(1);
  }
  console.log(
    '\u2713 Self-test passed: carried-forward samples are not read as this ' +
      "launch's, and\n  multi-series reads use only fresh series.",
  );
  process.exit(0);
}

const runs = [];

for (let i = 1; i <= RUNS; i++) {
  // Per-metric, not one shared baseline: each metric's freshness is judged
  // against its own last write, so a metric this launch never emits is
  // reported as absent rather than inheriting another metric's liveness.
  const before = {};
  for (const m of METRICS) before[m] = await lastWriteSeconds(m);

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
    if (
      (await lastWriteSeconds('app_content_appeared_ms')) >
      before.app_content_appeared_ms
    ) {
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
    const { value, stale } = await readFreshMetric(m, before[m]);
    row[m] = value;
    if (value === null && stale > 0) {
      // Worth saying out loud: the query DID return data, and taking it would
      // have recorded another launch's number as this one's.
      console.log(
        `  ${m}: no sample from this launch (${stale} stale ignored)`,
      );
    }
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
// `e2e/artifacts/` is gitignored, so on a fresh checkout it does not exist and
// this threw AFTER every launch had already been captured — losing the whole
// run at the last step.
mkdirSync(dirname(out), { recursive: true });
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
