import { NativeModules } from 'react-native';
import { isRecord } from '#/utils/isRecord';

/**
 * A native module's method bound to it, or null when the build lacks either.
 * Looked up per call, never captured at module scope: `index.js` imports these
 * wrappers before every module registers, and a captured miss stays a miss.
 */
export function nativeMethod(
  moduleName: string,
  method: string,
): ((...args: unknown[]) => unknown) | null {
  const nativeModule: unknown = NativeModules[moduleName];
  if (!isRecord(nativeModule)) return null;
  const fn = nativeModule[method];
  return typeof fn === 'function'
    ? (...args): unknown => Reflect.apply(fn, nativeModule, args)
    : null;
}

/** The entries `parse` accepts from a list the native side returned. */
export const parseList = <T>(
  value: unknown,
  parse: (entry: unknown) => T | null,
): T[] =>
  Array.isArray(value) ? value.flatMap(entry => parse(entry) ?? []) : [];
