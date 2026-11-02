import { execFileSync } from 'child_process';
import path from 'path';

/**
 * The API's CI validates persisted-query-manifest.json at every store tag and
 * trusts what the tag holds, so an operation the file misses goes unchecked.
 * The pre-push drift check skips a dirty tree, which a shared checkout nearly
 * always is, so this is what holds the file to its sources.
 */

const ROOT = path.join(__dirname, '..', '..');
const GENERATOR = path.join(ROOT, 'scripts', 'generate-pq-manifest.mjs');

it('the persisted query manifest matches the .graphql sources', () => {
  expect(() =>
    execFileSync('node', [GENERATOR, '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  ).not.toThrow();
}, 60_000);
