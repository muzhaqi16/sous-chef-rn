#!/usr/bin/env node
/**
 * Frame-timeline capture for an iOS cold start.
 *
 * The iOS analogue of the Android two-method agreement check: sample the screen
 * in a loop from launch, classify each frame by PNG byte size, and read off when
 * real content appeared. On Android that was `adb exec-out screencap`; here it is
 * `xcrun simctl io <device> screenshot`.
 *
 * Sampling resolution bounds what this can resolve: at ~450 ms per screenshot a
 * change smaller than one sample is not a result.
 *
 * Why it matters more on iOS than it did on Android: Android could cross-check
 * `app_fully_drawn_ms` against the OS itself, because `Activity.reportFullyDrawn()`
 * makes logcat print `ActivityTaskManager: Fully drawn`. iOS has no API that
 * accepts an app-declared fully-drawn signal, so there is no OS marker to agree
 * with. This loop is the ONLY second method available on this platform, which
 * is why the Android two-method agreement result does not carry over and has to
 * be re-established here.
 *
 * The instrument's resolution is reported per run, not assumed. A difference
 * smaller than one sampling interval is not a result — on the Android phone the
 * interval was ~450 ms, which could not have resolved a 100 ms change.
 *
 * Measured on this Mac 2026-08-25 against a booted iPhone 17 (Xcode 26.6,
 * iOS 26.5), n=20 over a static screen: **median 176 ms per screenshot**
 * (min 159, max 351). That is between the Android emulator's 130-160 ms and the
 * phone's ~450 ms — usable for the ~2 s scale of a cold start, and NOT usable
 * for anything under ~200 ms. If the question needs finer resolution, the
 * upgrade is `xcrun simctl io <device> recordVideo` plus frame extraction,
 * which needs ffmpeg (not a dependency of this repo).
 *
 * Disk: `simctl` writes full-resolution PNGs with no downscale option — ~2.9 MB
 * each on an iPhone 17, so a 12 s run is ~200 MB. The output directory is wiped
 * at the start of every run for that reason.
 *
 * Usage:
 *   node scripts/ios-frame-sample.mjs [--device "iPhone 17"] [--seconds 12]
 *                                     [--bundle dev.souschef.app] [--out DIR]
 *
 * Notes:
 *   - The app must already be installed AND signed in. This launches an
 *     existing install; it does not build, install or authenticate. Run a Detox
 *     pass first (`reinstallApp: false` keeps the session), then this.
 *   - Run it against a RELEASE build. Debug numbers are not comparable.
 */
import { mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { median, parseFlags, sh } from './lib/tooling.mjs';

const flags = parseFlags({
  device: { type: 'string', default: 'iPhone 17' },
  bundle: { type: 'string', default: 'dev.souschef.app' },
  seconds: { type: 'string', default: '12' },
  out: { type: 'string' },
});

const DEVICE = flags.device;
const BUNDLE = flags.bundle;
const SECONDS = Number(flags.seconds);
const OUT = flags.out ?? join('e2e', 'artifacts', 'ios-frames');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

try {
  sh('xcrun', ['simctl', 'boot', DEVICE]);
} catch {
  // Already booted is the normal case, and simctl reports it as a failure.
}
sh('xcrun', ['simctl', 'bootstatus', DEVICE]);

try {
  sh('xcrun', ['simctl', 'terminate', DEVICE, BUNDLE]);
} catch {
  // Not running — that is what we want anyway.
}

// Sample.
// The launch happens INSIDE the sampling window so the first frames capture the
// pre-launch state, which is what makes the first transition legible.
const frames = [];
const t0 = performance.now();

sh('xcrun', ['simctl', 'launch', DEVICE, BUNDLE]);
const launchedAt = performance.now() - t0;

while (performance.now() - t0 < SECONDS * 1000) {
  const at = performance.now() - t0;
  const path = join(OUT, `frame-${String(frames.length).padStart(4, '0')}.png`);
  try {
    sh('xcrun', ['simctl', 'io', DEVICE, 'screenshot', path]);
  } catch {
    continue; // a dropped sample is a gap, not a failure
  }
  frames.push({
    index: frames.length,
    atMs: Math.round(at),
    bytes: statSync(path).size,
  });
}

if (frames.length < 2) {
  console.error(`Captured ${frames.length} frame(s) — nothing to report.`);
  process.exit(1);
}

// Resolution of the instrument.
const gaps = frames.slice(1).map((f, i) => f.atMs - frames[i].atMs);
const resolution = {
  samples: frames.length,
  minMs: Math.min(...gaps),
  medianMs: Math.round(median(gaps)),
  maxMs: Math.max(...gaps),
};

// Anchor the run to the launch.
// The first frames can still show what was on screen BEFORE the launch, and
// that frame is often the LARGEST of the run (3.21 MB against a 776 KB settled
// one), defining the top of the scale and pushing every real frame down a band.
// The blankest frame is the launch itself, so frames before it are dropped.
const anchorIndex = frames.reduce(
  (best, f, i) => (f.bytes < frames[best].bytes ? i : best),
  0,
);
const launchFrames = frames.slice(anchorIndex);

// Classify.
// Byte size stands in for visual complexity: a blank screen compresses far
// smaller than one full of rows and thumbnails. Bands are derived from this
// run's own post-anchor distribution so they adapt to device resolution, and the
// raw PNGs are kept so the classification can be checked against what is
// actually on screen rather than trusted.
const sizes = launchFrames.map(f => f.bytes);
const lo = Math.min(...sizes);
const hi = Math.max(...sizes);
const band = value => {
  const p = (value - lo) / (hi - lo || 1);
  if (p < 0.15) return 'blank';
  if (p < 0.5) return 'partial';
  return 'settled';
};
for (const f of frames)
  f.band = f.atMs < launchFrames[0].atMs ? 'pre-launch' : band(f.bytes);

const transitions = launchFrames.filter(
  (f, i) => i === 0 || f.band !== launchFrames[i - 1].band,
);

// Settle detection.
// Bands are relative, so the tallest frame is always "settled" even mid-load.
// What marks the end of a load is the frame size going FLAT, so: take the
// plateau as the median of the final quarter of the run, then report the first
// post-anchor frame that reaches it and stays there.
const TOLERANCE = 0.05;
const tail = launchFrames.slice(Math.floor(launchFrames.length * 0.75));
const plateau = median(tail.map(f => f.bytes));
const near = f => Math.abs(f.bytes - plateau) / (plateau || 1) <= TOLERANCE;
const settledIdx = launchFrames.findIndex(
  (f, i) => near(f) && launchFrames.slice(i).every(near),
);
const firstSettled = settledIdx === -1 ? null : launchFrames[settledIdx];

const report = {
  device: DEVICE,
  bundle: BUNDLE,
  capturedAt: new Date().toISOString(),
  launchIssuedAtMs: Math.round(launchedAt),
  resolution,
  sizeRange: { minBytes: lo, maxBytes: hi },
  launchAnchorMs: launchFrames[0].atMs,
  droppedPreLaunchFrames: anchorIndex,
  plateauBytes: plateau,
  firstSettledMs: firstSettled ? firstSettled.atMs : null,
  transitions: transitions.map(f => ({
    atMs: f.atMs,
    band: f.band,
    bytes: f.bytes,
  })),
  frames,
};
writeFileSync(join(OUT, 'frames.json'), JSON.stringify(report, null, 2));

console.log(
  `\nDevice ${DEVICE} · bundle ${BUNDLE} · ${frames.length} frames -> ${OUT}`,
);
console.log(
  `Sampling interval: median ${resolution.medianMs} ms ` +
    `(min ${resolution.minMs}, max ${resolution.maxMs}). ` +
    `Differences smaller than this are NOT resolvable.`,
);
console.log(
  `Launch anchor at ${launchFrames[0].atMs} ms ` +
    `(dropped ${anchorIndex} pre-launch frame(s)); plateau ${plateau} bytes.`,
);
console.log('\nTransitions (relative to the anchor):');
for (const t of transitions) {
  console.log(
    `  ${String(t.atMs).padStart(6)} ms  ${t.band.padEnd(8)} ${t.bytes} bytes`,
  );
}
console.log(
  firstSettled
    ? `\nSettled at ${firstSettled.atMs} ms, i.e. ` +
        `${
          firstSettled.atMs - launchFrames[0].atMs
        } ms after the launch anchor ` +
        `(±${resolution.medianMs} ms).` +
        `\nCompare against app_fully_drawn_ms — but note that metric starts at JS` +
        `\nbundle entry, while this clock starts before the launch was issued, so` +
        `\nthey do NOT share an origin and will not reconcile exactly.`
    : '\nNo settled frame — widen --seconds, or the app never finished loading.',
);
