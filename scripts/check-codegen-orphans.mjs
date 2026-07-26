#!/usr/bin/env node
// Find `<name>.generated.ts` files under `src/` that have no sibling
// `<name>.graphql` source. These are leftovers from deleted `.graphql`
// files — `near-operation-file` does not clean them up, and they break
// `tsc` when they import fragment types that no longer exist.
//
// Pass `--fix` to delete the orphans.

import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const SKIP_DIRS = new Set(['node_modules', 'generated']);
// `.generated.ts` files written by something other than graphql-codegen, so
// they legitimately have no `.graphql` sibling. `env.generated.ts` comes from
// `scripts/generate-env.js`.
const SKIP_FILES = new Set([join(SRC, 'config', 'env.generated.ts')]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(full, out);
    } else if (entry.endsWith('.generated.ts') && !SKIP_FILES.has(full)) {
      out.push(full);
    }
  }
  return out;
}

const fix = process.argv.includes('--fix');
const orphans = walk(SRC).filter(f => {
  const source = f.replace(/\.generated\.ts$/, '.graphql');
  try {
    statSync(source);
    return false;
  } catch {
    return true;
  }
});

if (orphans.length === 0) {
  console.log('No orphaned .generated.ts files found.');
  process.exit(0);
}

for (const f of orphans) {
  const rel = f.slice(ROOT.length + 1);
  if (fix) {
    unlinkSync(f);
    console.log(`deleted ${rel}`);
  } else {
    console.log(`orphan  ${rel}`);
  }
}

if (!fix) {
  console.log(
    `\n${orphans.length} orphan(s) found. Re-run with --fix to delete.`,
  );
  process.exit(1);
}
