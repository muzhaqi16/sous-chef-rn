#!/usr/bin/env node
/**
 * Bound how many Detox artifact runs are kept on disk.
 *
 * Detox writes one timestamped directory per run under each configuration's
 * `rootDir`, and has no retention setting of its own. Two of this repo's
 * configurations deliberately keep artifacts on a PASS — the debug one because
 * the UI-tour workflow reads those screenshots, the release one because a
 * successful measuring run is exactly the run whose log is wanted — so nothing
 * ever deleted anything. Measured 2026-08-25: `e2e/artifacts/` held 17 GB.
 *
 * The policy is a COUNT, not an age: what you want back is "the last few runs",
 * and a run you took last month is not more interesting for having been recent.
 *
 *   node scripts/prune-e2e-artifacts.mjs [--keep 5] [--dry-run]
 *
 * Deletes nothing outside `e2e/artifacts/`, and never the newest `--keep` runs.
 */
import { readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const KEEP = Number(arg('keep', '5'));
const DRY_RUN = args.includes('--dry-run');

if (!Number.isInteger(KEEP) || KEEP < 1) {
  console.error(`✗ --keep must be a positive integer (got "${arg('keep')}").`);
  process.exit(2);
}

const ROOT = fileURLToPath(new URL('../e2e/artifacts', import.meta.url));

if (!existsSync(ROOT)) {
  console.log('Nothing to prune: e2e/artifacts does not exist.');
  process.exit(0);
}

const bytes = n => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(1)} ${units[u]}`;
};

const dirSize = dir => {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    try {
      total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
    } catch {
      // Raced with something else deleting it — not our problem to report.
    }
  }
  return total;
};

let reclaimed = 0;
let removed = 0;

// One level down is a configuration (`ios-simulator`, `android-device`, …);
// two levels down is a run. Files directly under the root — the baseline JSON
// this script must not touch — are skipped.
for (const config of readdirSync(ROOT, { withFileTypes: true })) {
  if (!config.isDirectory()) continue;
  const configDir = join(ROOT, config.name);

  const runs = readdirSync(configDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => {
      const full = join(configDir, e.name);
      return { name: e.name, full, mtime: statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  const stale = runs.slice(KEEP);
  if (!stale.length) {
    console.log(`${config.name}: ${runs.length} run(s), nothing to prune.`);
    continue;
  }

  const freed = stale.reduce((sum, run) => sum + dirSize(run.full), 0);
  reclaimed += freed;
  removed += stale.length;

  console.log(
    `${config.name}: ${runs.length} run(s) → keeping ${KEEP}, ` +
      `removing ${stale.length} (${bytes(freed)})`,
  );
  if (!DRY_RUN) {
    for (const run of stale) rmSync(run.full, { recursive: true, force: true });
  }
}

console.log(
  DRY_RUN
    ? `\nDry run: would remove ${removed} run(s), reclaiming ${bytes(
        reclaimed,
      )}.`
    : `\nRemoved ${removed} run(s), reclaiming ${bytes(reclaimed)}.`,
);
