#!/usr/bin/env node
// The PR gate over production dependencies: `npm audit --omit=dev`, failing on
// any high or critical advisory except those in ACCEPTED. An accepted advisory
// has no patched release and was accepted by the user; the weekly
// `dependency-audit.yml` still reports it. An entry npm no longer reports fails
// the gate, so it is removed in the change that clears it.
//
// Usage: node scripts/check-audit.mjs

import { execFileSync } from 'node:child_process';

/** Advisory id → why it is accepted, and when. */
const ACCEPTED = new Map([
  [
    'GHSA-vfj7-8cjw-p6xm',
    'braces <=3.0.3 has no patched release and is reached only through Metro build tooling (2026-10-03)',
  ],
]);

let raw;
try {
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (error) {
  // npm audit exits 1 when it finds anything; the report is still on stdout.
  raw = error.stdout;
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error(`npm audit printed no report:\n${raw}`);
  process.exit(1);
}
// A run that could not reach the registry exits 1 with `{ error }` and no
// `vulnerabilities`; counting that as clean would pass the gate.
if (report.error || !report.vulnerabilities) {
  console.error(
    `npm audit did not run: ${JSON.stringify(report.error ?? report)}`,
  );
  process.exit(1);
}

const blocking = new Map();
const found = new Set();
for (const vulnerability of Object.values(report.vulnerabilities)) {
  for (const advisory of vulnerability.via) {
    // A string names another vulnerable package, whose entry holds the advisory.
    if (typeof advisory !== 'object') continue;
    if (advisory.severity !== 'high' && advisory.severity !== 'critical') {
      continue;
    }
    const id = advisory.url?.split('/').pop() ?? String(advisory.source);
    if (ACCEPTED.has(id)) {
      found.add(id);
    } else {
      blocking.set(
        id,
        `${advisory.severity} ${advisory.name}: ${advisory.title} (${advisory.url})`,
      );
    }
  }
}

const stale = [...ACCEPTED.keys()].filter(id => !found.has(id));
for (const id of found) console.log(`accepted ${id}: ${ACCEPTED.get(id)}`);

if (blocking.size > 0 || stale.length > 0) {
  for (const line of blocking.values()) console.error(line);
  for (const id of stale) {
    console.error(`${id} is no longer reported: remove it from ACCEPTED`);
  }
  process.exit(1);
}
console.log(
  '✓ No unaccepted high or critical advisory in production dependencies.',
);
