/**
 * Where the app's source lives, for every tool that reads it: a new root is
 * added here and nowhere else.
 *
 * `PRODUCTION_ROOTS` hold production code. `OPERATION_ROOTS` hold the `.graphql`
 * documents that codegen, the persisted-query manifest, the readers and
 * GraphQL lint read; the first is the core's, where the readers are written.
 *
 * Repo-relative. CommonJS because the ESLint and Jest configs load it before
 * any transform runs.
 */

const PRODUCTION_ROOTS = ['src'];

const OPERATION_ROOTS = ['src'];

/** `<root>/<pattern>` for each operation root, as globs relative to the repo. */
const operationGlobs = (pattern = '**/*.graphql') =>
  OPERATION_ROOTS.map(root => `${root}/${pattern}`);

module.exports = { PRODUCTION_ROOTS, OPERATION_ROOTS, operationGlobs };
