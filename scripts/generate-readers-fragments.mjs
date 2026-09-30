#!/usr/bin/env node
/**
 * Writes `src/graphql/readers/<type>Readers.graphql` for each `...<Type>Readers`
 * spread; part of `npm run codegen`. `--check` writes nothing and fails on a
 * stale file, as `find-stale-cache-fields.mjs` does in CI. `--src <dir>` reads
 * another documents tree and writes its `graphql/readers/`.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { REPO_ROOT } from './lib/tooling.mjs';
import {
  documentsRoot,
  loadDocuments,
  loadSchema,
} from './lib/graphqlDocuments.mjs';
import { readersDirOf, staleReadersFiles } from './lib/readersFragments.mjs';

const CHECK = process.argv.includes('--check');
const root = documentsRoot();
const readersDir = readersDirOf(root);
const schema = loadSchema('generate-readers-fragments');
const { expected, stale } = staleReadersFiles(
  schema,
  loadDocuments(root),
  readersDir,
);

if (CHECK) {
  if (stale.length) {
    console.error('✗ Readers fragments are out of date:');
    for (const path of stale) console.error(`  ${relative(REPO_ROOT, path)}`);
    console.error('\n  Run `npm run codegen:readers`.');
    process.exit(1);
  }
  console.log(`✓ ${expected.size} readers fragments are up to date`);
  process.exit(0);
}

mkdirSync(readersDir, { recursive: true });
for (const path of stale) {
  const text = expected.get(path);
  if (text === undefined) rmSync(path);
  else writeFileSync(path, text);
  console.log(
    `${text === undefined ? '✗ removed' : '✓ wrote'} ${relative(
      REPO_ROOT,
      path,
    )}`,
  );
}
console.log(`${expected.size} readers fragments, ${stale.length} changed`);
