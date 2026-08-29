#!/usr/bin/env node
/**
 * A write opts into the offline queue through ONE path.
 *
 * `context: { localFirst: true }` is what makes a mutation replayable, and
 * every site that sets it by hand also hand-rolls the lifecycle around it — the
 * cache write, the undo, the connection move, the parent counters, the
 * three-way branch over queued / refused / network. That is the duplication
 * `src/apollo/write/` exists to remove, and this is what stops it growing back.
 *
 * NON-EMPTY baseline, and that is deliberate for now: it is a WORKLIST, not an
 * invariant. It can only shrink. It becomes an invariant (baseline 0) once
 * every durable site has converted and the online-only tier has been demoted —
 * until then a zero baseline would fail on work that has not been scheduled
 * yet, which teaches people to ignore the check.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const KIT = join('src', 'apollo', 'write');
const BASELINE = join(ROOT, 'scripts', 'check-declared-writes.baseline.json');
const NEEDLE = /localFirst:\s*true/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  // The kit is where the opt-in is SUPPOSED to live.
  if (rel.startsWith(KIT)) continue;
  const source = readFileSync(file, 'utf8');
  const count = source.split('\n').filter(line => NEEDLE.test(line)).length;
  if (count > 0) offenders.push({ file: rel, count });
}
offenders.sort((a, b) => a.file.localeCompare(b.file));

const total = offenders.reduce((sum, o) => sum + o.count, 0);

if (process.argv.includes('--update-baseline')) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify({ total, files: offenders }, null, 2)}\n`,
  );
  console.log(`check-declared-writes: baseline written at ${total} site(s).`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  console.error(
    'check-declared-writes: no baseline. Run with --update-baseline.',
  );
  process.exit(1);
}

if (total > baseline.total) {
  const known = new Map(baseline.files.map(f => [f.file, f.count]));
  const grown = offenders.filter(o => (known.get(o.file) ?? 0) < o.count);
  console.error(
    `✗ check-declared-writes: ${total} hand-rolled opt-in(s), baseline ${baseline.total}.`,
  );
  console.error('\nNew or grown since the baseline:');
  for (const o of grown) {
    console.error(`  ${o.file} (${known.get(o.file) ?? 0} → ${o.count})`);
  }
  console.error(
    '\nA write that must survive being made offline goes through `useWrite`\n' +
      'from src/apollo/write/, which owns the cache write, the undo that\n' +
      'reverses it, and the context that carries both to the queue.\n',
  );
  process.exit(1);
}

if (total < baseline.total) {
  console.log(
    `check-declared-writes: ${total} site(s), down from ${baseline.total} — ` +
      'run with --update-baseline to lock the improvement in.',
  );
  process.exit(0);
}

console.log(
  `check-declared-writes: ${total} hand-rolled opt-in(s), baseline ${baseline.total}. ` +
    'Worklist, not an invariant — it may only shrink.',
);
