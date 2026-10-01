/**
 * Lets Node load the app's TypeScript utils as they are: `#/x` resolves to
 * `src/x`, and an extensionless relative import tries `.ts` then `.tsx`.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

export async function resolve(specifier, context, next) {
  const mapped = specifier.startsWith('#/')
    ? pathToFileURL(SRC + specifier.slice(2)).href
    : specifier;
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
