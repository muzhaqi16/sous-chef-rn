import * as path from 'node:path';

const { OPERATION_ROOTS, PRODUCTION_ROOTS } =
  require('../../scripts/lib/sourceRoots.js') as {
    OPERATION_ROOTS: string[];
    PRODUCTION_ROOTS: string[];
  };

const REPO_ROOT = path.join(__dirname, '..', '..');

/** Each tree of `.graphql` documents the app sends, as an absolute path. */
export const OPERATION_ROOT_DIRS = OPERATION_ROOTS.map(root =>
  path.join(REPO_ROOT, root),
);

/** Each tree of production code, as an absolute path. */
export const PRODUCTION_ROOT_DIRS = PRODUCTION_ROOTS.map(root =>
  path.join(REPO_ROOT, root),
);
