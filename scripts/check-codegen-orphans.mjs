#!/usr/bin/env node
// Find `<name>.generated.ts` files under `src/` that have no sibling
// `<name>.graphql` source. These are leftovers from deleted `.graphql`
// files — `near-operation-file` does not clean them up, and they break
// `tsc` when they import fragment types that no longer exist.
//
// Pass `--fix` to delete the orphans.

import { statSync, unlinkSync } from 'node:fs';
import { relative } from 'node:path';
import { filesUnder, fromRoot, REPO_ROOT } from './lib/tooling.mjs';

const SKIP = [/(^|\/)(node_modules|generated)(\/|$)/];
// Written by `scripts/generate-env.js`, not graphql-codegen, so it legitimately
// has no `.graphql` sibling. Filtered by path rather than by the glob's
// `exclude`, which is called with bare basenames for files.
const SKIP_FILES = new Set([fromRoot('src', 'config', 'env.generated.ts')]);

const fix = process.argv.includes('--fix');
const orphans = filesUnder('src/**/*.generated.ts', { exclude: SKIP })
  .filter(f => !SKIP_FILES.has(f))
  .filter(f => {
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
  const rel = relative(REPO_ROOT, f);
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
