/**
 * Persisted-query manifest generation (operation-safelist client contract).
 *
 * `@apollo/generate-persisted-query-manifest` requires one operation per
 * .graphql file, but this repo groups many operations per file (pantry.graphql
 * etc.). This wrapper splits every source file into single-definition temp
 * files (operations individually; fragment definitions preserved for the
 * tool's global fragment registry), runs the generator programmatically, and
 * writes `persisted-query-manifest.json` at the repo root.
 *
 * Hash identity: the manifest id is sha256(print(sortTopLevelDefinitions(op)))
 * — the same value `persistedQueryLink` computes at runtime via
 * `generatePersistedQueryIdsAtRuntime`, so ids match the wire by construction.
 * The API's safelist plugin reads `operations[].id` from this file.
 */

import { createRequire } from 'node:module';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  globSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { parse, print, Kind } = require('graphql');
const {
  generatePersistedQueryManifest,
} = require('@apollo/generate-persisted-query-manifest');

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(repoRoot, 'persisted-query-manifest.json');

// `exclude` is called with both bare directory names and repo-relative paths,
// so the pattern has to be anchored on a path segment: a `startsWith('src/...')`
// predicate never sees the directory and lets `generated/schema.graphql`
// through. globSync does not sort, and the manifest's operation order has to be
// stable across machines.
const files = globSync('src/**/*.graphql', {
  cwd: repoRoot,
  exclude: p => /(^|\/)graphql\/generated(\/|$)/.test(p),
})
  .map(f => join(repoRoot, f))
  .sort();

const tmp = mkdtempSync(join(tmpdir(), 'pq-manifest-'));

try {
  // Some operations exist as byte-identical copies in more than one .graphql
  // file (codegen tolerates identical copies and only errors once they
  // diverge). Identical copies hash identically, so keep the first and skip
  // the rest — but fail hard on a name collision with a DIFFERENT body: that
  // is exactly the divergence codegen would eventually reject, caught here
  // with both file paths named.
  const seenOperations = new Map();

  for (const file of files) {
    const doc = parse(readFileSync(file, 'utf8'));
    // Flat, collision-free temp name per source file.
    const base = relative(join(repoRoot, 'src'), file)
      .replace(/\.graphql$/, '')
      .replace(/[\\/]/g, '__');

    const fragments = doc.definitions.filter(
      d => d.kind === Kind.FRAGMENT_DEFINITION,
    );
    const operations = doc.definitions.filter(
      d => d.kind === Kind.OPERATION_DEFINITION,
    );

    if (fragments.length > 0) {
      writeFileSync(
        join(tmp, `${base}.fragments.graphql`),
        fragments.map(d => print(d)).join('\n\n'),
      );
    }
    operations.forEach((op, i) => {
      const name = op.name?.value ?? `anonymous_${i}`;
      const printed = print(op);
      const seen = seenOperations.get(name);
      if (seen) {
        if (seen.printed !== printed) {
          throw new Error(
            `Operation "${name}" diverges between ${seen.file} and ${file} — identical copies are tolerated, divergent ones are not`,
          );
        }
        return;
      }
      seenOperations.set(name, { printed, file });
      writeFileSync(join(tmp, `${base}.${name}.graphql`), printed);
    });
  }

  const manifest = await generatePersistedQueryManifest({
    documents: [join(tmp, '*.graphql')],
  });

  writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `✓ persisted-query-manifest.json written with ${manifest.operations.length} operations`,
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
