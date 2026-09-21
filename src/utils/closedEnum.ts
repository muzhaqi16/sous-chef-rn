import { logger } from '#/utils/environment';

/**
 * The server and the app are versioned separately, so a member of a closed
 * enum can reach a build that has never heard of it. These make that case
 * explicit instead of letting it read as `undefined`.
 */

/** A map entry, or undefined for a member added server-side after this build. */
export function knownEntry<K extends string, V>(
  table: Record<K, V>,
  key: K,
): V | undefined {
  return table[key];
}

/**
 * The `default` of a switch over a closed enum. The `never` parameter fails the
 * build when codegen adds a member the switch does not handle; at run time the
 * value is one the server added after this build, and is logged.
 */
export function unknownMember(value: never, context: string): void {
  logger.warn(`Unrecognised ${context}:`, String(value));
}
