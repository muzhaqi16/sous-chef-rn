import { gql, type ApolloCache, type StoreObject } from '@apollo/client';
import type { DocumentNode } from 'graphql';

/**
 * The normalized entity holding the fields; its GraphQL field names must match the
 * keys of `TFields`. Intersected with `StoreObject` to satisfy `cache.identify`.
 */
export type FieldsEntityRef = StoreObject & {
  __typename: string;
  id: string;
};

/** An object the cache should normalize rather than store inline. */
function isEntityLike(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    '__typename' in value
  );
}

/**
 * The selection a value needs, as GraphQL source; empty for a leaf. `__typename`
 * separates a nested ENTITY from an object-shaped JSON scalar, and selecting
 * through it is what makes the cache normalize rather than store a private copy.
 */
function selectionFor(value: unknown): string {
  if (Array.isArray(value)) {
    const entities = value.filter(isEntityLike);
    if (entities.length === 0 || entities.length !== value.length) return '';
    // The intersection: selecting a key some element lacks makes the write warn
    // and store a hole.
    const shared = entities
      .map(entry => Object.keys(entry))
      .reduce((acc, keys) => acc.filter(key => keys.includes(key)));
    return selectionFor(
      Object.fromEntries(shared.map(k => [k, entities[0]?.[k]])),
    );
  }
  if (!isEntityLike(value)) return '';

  const inner = Object.keys(value)
    .filter(key => key !== '__typename')
    .map(key => `${key}${selectionFor(value[key])}`);
  return ` { __typename ${inner.join(' ')} }`;
}

/**
 * Write flat fields onto a cached entity. `undefined` values are skipped so a
 * partial update never blanks a field, and an unidentifiable entity is a no-op
 * rather than a write against ROOT_QUERY.
 */
export function writeEntityFields<TFields extends object>(
  cache: ApolloCache,
  entity: FieldsEntityRef | undefined,
  updates: Partial<TFields>,
): void {
  if (!entity) return;
  const cacheId = cache.identify(entity);
  if (!cacheId) return;

  const written = Object.entries(updates).filter(
    ([, value]) => value !== undefined,
  );
  if (written.length === 0) return;

  const selections = written
    .map(([field, value]) => `${field}${selectionFor(value)}`)
    .join('\n    ');

  // `writeFragment`, not `cache.modify`: modify silently drops a field the
  // record lacks and stores a nested entity as a private copy. Verified vs
  // `@apollo/client@4.2.12`: `docs/verified-library-behaviour.md#cachemodify-cannot-add-a-field`.
  cache.writeFragment({
    id: cacheId,
    fragment: localFirstFragment(entity.__typename, selections),
    data: { __typename: entity.__typename, ...Object.fromEntries(written) },
  });
}

/**
 * The runtime fragment for one (type, field-shape) pair, memoized. Content varies
 * per call site, so a FIXED fragment name makes graphql-tag warn per shape and
 * grow a module-scope cache that never hits; the name is derived from the content.
 */
const localFirstFragments = new Map<string, DocumentNode>();

export function localFirstFragment(
  typename: string,
  selections: string,
): DocumentNode {
  const shapeKey = `${typename}:${selections}`;
  const memo = localFirstFragments.get(shapeKey);
  if (memo) return memo;

  const built = gql`
      fragment LocalFirstFields_${typename}_${shapeHash(
    shapeKey,
  )} on ${typename} {
        __typename
        ${selections}
      }
    `;
  localFirstFragments.set(shapeKey, built);
  return built;
}

/**
 * A short, stable digest of a field shape — djb2 in base-36, so the result is
 * name-safe. Only needs uniqueness per shape within one process.
 */
function shapeHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * The pre-write values of the keys an update writes. A key the source does not
 * CARRY is OMITTED, so the revert leaves it alone; one carried AS null is
 * recorded. Absent from the read is not empty in the store.
 */
export function snapshotFields<TFields extends object>(
  // `object`, not `Record<string, unknown>`: an interface without an index
  // signature is not assignable to that, forcing a cast at every call site.
  source: object | null | undefined,
  updates: Partial<TFields>,
): Partial<TFields> {
  if (!source) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    if (key in source) out[key] = Reflect.get(source, key);
  }
  return out as Partial<TFields>;
}
