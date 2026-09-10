#!/usr/bin/env node
/**
 * Fails on a known vulnerability in a PRODUCTION dependency.
 *
 * Dependabot proposes upgrades; it does not fail anything. Nothing in CI read
 * the advisory database, so a vulnerable dependency reached the default branch
 * with every check green. This is the gate that refuses it.
 *
 *   node scripts/check-dependency-audit.mjs            # fail at high+
 *   node scripts/check-dependency-audit.mjs --level=critical
 *   node scripts/check-dependency-audit.mjs --json     # machine-readable summary
 *   node scripts/check-dependency-audit.mjs --self-test
 *
 * An advisory that cannot be fixed is recorded in
 * `scripts/accepted-advisories.json` with a reason and a revisit date, and is
 * reported on every run so an exemption stays visible rather than forgotten.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACCEPTED_PATH = join(REPO_ROOT, 'scripts', 'accepted-advisories.json');

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];

/** Advisories at or above `level`, by severity rank. */
function atOrAbove(severity, level) {
  return SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf(level);
}

/**
 * Accepted advisories, each `{ id, package, reason, revisit }`. An entry whose
 * revisit date has passed is reported as expired: an exemption with no end date
 * is a permanent one under another name.
 */
function readAccepted() {
  if (!existsSync(ACCEPTED_PATH)) return [];
  const parsed = JSON.parse(readFileSync(ACCEPTED_PATH, 'utf8'));
  return Array.isArray(parsed.accepted) ? parsed.accepted : [];
}

/**
 * `npm audit --json` exits non-zero when it finds anything, so the exit code
 * cannot distinguish "vulnerabilities found" from "audit could not run". Read
 * the payload and let a parse failure be the error instead.
 */
function runAudit() {
  let raw;
  try {
    raw = execFileSync(
      'npm',
      ['audit', '--omit=dev', '--json', '--audit-level=info'],
      { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
  } catch (error) {
    raw = error.stdout;
  }
  if (!raw) {
    throw new Error('npm audit produced no output');
  }
  return JSON.parse(raw);
}

/** Flatten `npm audit --json` (v2 schema) into one row per advisory. */
export function collectFindings(report) {
  const findings = [];
  const seen = new Set();
  for (const [name, entry] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of entry.via ?? []) {
      if (typeof via === 'string') continue;
      const id = via.url ?? `${via.source ?? via.title}`;
      const key = `${name}::${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        package: name,
        id,
        title: via.title ?? 'Unknown advisory',
        severity: via.severity ?? entry.severity ?? 'info',
        fixAvailable: Boolean(entry.fixAvailable),
      });
    }
  }
  return findings;
}

/**
 * Split findings into blocking and accepted. Matching is by advisory id or by
 * package name, so an entry stays valid when the advisory URL is reformatted.
 */
export function partitionFindings(findings, accepted, level) {
  const blocking = [];
  const excused = [];
  for (const finding of findings) {
    if (!atOrAbove(finding.severity, level)) continue;
    const match = accepted.find(
      entry =>
        (entry.id && finding.id.includes(entry.id)) ||
        (entry.package && entry.package === finding.package),
    );
    if (match) {
      excused.push({ ...finding, acceptance: match });
    } else {
      blocking.push(finding);
    }
  }
  return { blocking, excused };
}

/** Accepted entries whose revisit date has passed, as of `today`. */
export function expiredAcceptances(accepted, today = new Date()) {
  return accepted.filter(entry => {
    if (!entry.revisit) return true;
    const revisit = new Date(entry.revisit);
    return Number.isNaN(revisit.getTime()) || revisit < today;
  });
}

if (process.argv.includes('--self-test')) {
  const report = {
    vulnerabilities: {
      'left-pad': {
        severity: 'high',
        fixAvailable: true,
        via: [
          {
            title: 'Prototype pollution',
            url: 'https://github.com/advisories/GHSA-test-1111',
            severity: 'high',
          },
        ],
      },
      'tiny-thing': {
        severity: 'low',
        fixAvailable: false,
        via: [
          {
            title: 'ReDoS',
            url: 'https://github.com/advisories/GHSA-test-2222',
            severity: 'low',
          },
        ],
      },
    },
  };

  const findings = collectFindings(report);
  if (findings.length !== 2) {
    console.error(
      `✗ Self-test failed: expected 2 findings, got ${findings.length}.`,
    );
    process.exit(2);
  }

  const clean = partitionFindings(findings, [], 'high');
  if (clean.blocking.length !== 1 || clean.excused.length !== 0) {
    console.error(
      `✗ Self-test failed: a high advisory must block at level=high ` +
        `(blocking=${clean.blocking.length}, excused=${clean.excused.length}).`,
    );
    process.exit(2);
  }

  const withAcceptance = partitionFindings(
    findings,
    [{ id: 'GHSA-test-1111', reason: 'no fix', revisit: '2099-01-01' }],
    'high',
  );
  if (
    withAcceptance.blocking.length !== 0 ||
    withAcceptance.excused.length !== 1
  ) {
    console.error(
      '✗ Self-test failed: a recorded acceptance must excuse its advisory.',
    );
    process.exit(2);
  }

  const expired = expiredAcceptances([
    { id: 'a', revisit: '2000-01-01' },
    { id: 'b', revisit: '2099-01-01' },
    { id: 'c' },
  ]);
  if (expired.length !== 2) {
    console.error(
      `✗ Self-test failed: an acceptance with a past or missing revisit date ` +
        `must be reported as expired (got ${expired.length} of 2).`,
    );
    process.exit(2);
  }

  console.log(
    '✓ Self-test passed: advisories are flattened, severity gating holds,\n' +
      '  a recorded acceptance excuses its advisory, and a stale acceptance is reported.',
  );
  process.exit(0);
}

const levelArg = process.argv.find(arg => arg.startsWith('--level='));
const level = levelArg ? levelArg.split('=')[1] : 'high';
if (!SEVERITY_ORDER.includes(level)) {
  console.error(
    `✗ Unknown level "${level}". One of: ${SEVERITY_ORDER.join(', ')}.`,
  );
  process.exit(2);
}

const accepted = readAccepted();
const findings = collectFindings(runAudit());
const { blocking, excused } = partitionFindings(findings, accepted, level);
const expired = expiredAcceptances(accepted);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ level, blocking, excused, expired }, null, 2));
  process.exit(blocking.length > 0 ? 1 : 0);
}

for (const entry of excused) {
  console.log(
    `• Accepted: ${entry.package} ${entry.severity} — ${entry.title}\n` +
      `  ${entry.acceptance.reason} (revisit ${
        entry.acceptance.revisit ?? 'unset'
      })`,
  );
}

if (expired.length > 0) {
  console.log(
    `⚠ ${expired.length} accepted advisory record(s) are past their revisit ` +
      `date: ${expired.map(e => e.id ?? e.package).join(', ')}.`,
  );
}

if (blocking.length > 0) {
  console.error(
    `✗ ${blocking.length} production dependency vulnerability(ies) at ` +
      `${level} or above:\n` +
      blocking
        .map(
          f =>
            `  ${f.severity.toUpperCase().padEnd(8)} ${f.package} — ${
              f.title
            }\n` +
            `           ${f.id}${f.fixAvailable ? ' (fix available)' : ''}`,
        )
        .join('\n') +
      `\n\n  Upgrade the dependency, or record the advisory in ` +
      `scripts/accepted-advisories.json\n  with a reason and a revisit date.`,
  );
  process.exit(1);
}

console.log(
  `✓ No production dependency vulnerability at ${level} or above ` +
    `(${findings.length} advisory(ies) seen, ${excused.length} accepted).`,
);
