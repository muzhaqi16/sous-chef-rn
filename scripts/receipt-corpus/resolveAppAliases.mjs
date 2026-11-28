/**
 * Lets Node load the app's TypeScript utils as they are: an alias resolves
 * through the table Babel and Jest use (`scripts/lib/aliases.js`, from
 * tsconfig), and an extensionless relative import tries `.ts` then `.tsx`.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { babelAliases } = require('../lib/aliases.js');

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// Longest first, so `#components` wins over `#`.
const ALIASES = Object.entries(babelAliases());

const mapAlias = specifier => {
  for (const [alias, target] of ALIASES) {
    if (specifier === alias || specifier.startsWith(`${alias}/`)) {
      return pathToFileURL(
        path.resolve(ROOT, target + specifier.slice(alias.length)),
      ).href;
    }
  }
  return specifier;
};

export async function resolve(specifier, context, next) {
  const mapped = specifier.startsWith('#') ? mapAlias(specifier) : specifier;
  try {
    return await next(mapped, context);
  } catch (error) {
    if (!/^(\.|file:)/.test(mapped) || /\.[cm]?[jt]sx?$/.test(mapped)) {
      throw error;
    }
    for (const extension of ['.ts', '.tsx']) {
      try {
        return await next(mapped + extension, context);
      } catch {
        // Try the next extension.
      }
    }
    throw error;
  }
}
