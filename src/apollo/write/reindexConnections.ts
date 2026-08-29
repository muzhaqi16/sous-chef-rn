import type { ApolloCache, Reference } from '@apollo/client';
import { errorService } from '#/services/errorService';
import {
  parentCacheId,
  refToCacheId,
  type EntityRef,
  type Lifecycle,
  type ReindexSpec,
} from './writeIntent';

/**
 * Keep filtered collections correct after a patch moves an entity between them.
 *
 * This is `skipUnmatchedFilterVariants` widened from "skip this variant" to
 * "insert into or remove from this variant", and it keeps that primitive's
 * failure direction: a variant whose active filters are not ALL in
 * `decidableFilters` is left untouched. Its docblock states why, and the reason
 * generalizes — a row briefly missing from a cached list heals on that list's
 * next read from the server, while a row wrongly placed into one does not.
 *
 * Replaces the hand-written per-entity movers (purchased/unpurchased, filter
 * matchers, variant predicates), which each re-derived the same decision.
 */
export function reindexConnections(
  cache: ApolloCache,
  entity: EntityRef,
  spec: ReindexSpec,
  lifecycle: Lifecycle = 'patch',
): void {
  const parentId = parentCacheId(spec.parent);
  const entityId = refToCacheId(entity);

  try {
    cache.modify({
      id: parentId,
      fields: {
        [spec.field]: (existing: unknown, { storeFieldName, readField }) => {
          const decision = decideVariant(storeFieldName, spec, lifecycle);
          if (decision === 'skip') return existing;

          const connection = existing as
            | {
                edges?: { cursor?: string; node?: Reference }[];
                totalCount?: number;
              }
            | undefined;
          if (!connection || !Array.isArray(connection.edges)) return existing;

          const has = connection.edges.some(
            edge => edge?.node && readField('id', edge.node) === entity.id,
          );

          if (decision === 'include') {
            if (has) return existing;
            // Prepended rather than appended: the row the person just acted on
            // belongs where they will look for it, and the server's next read
            // settles the real order.
            // `cursor` is selected by every connection query in this app, and
            // a normalized read is all-or-nothing — an edge without one makes
            // the WHOLE destination connection read incomplete, which offline
            // means the list shows nothing at all rather than one odd row.
            // The id is a stable, unique stand-in until the server's next page
            // replaces the edge wholesale.
            const edge: Record<string, unknown> = {
              __typename: `${entity.__typename}Edge`,
              cursor: entity.id,
              node: { __ref: entityId },
            };
            return {
              ...connection,
              edges: [edge, ...connection.edges],
              totalCount:
                (connection.totalCount ?? connection.edges.length) + 1,
            };
          }

          if (!has) return existing;
          const edges = connection.edges.filter(
            edge => !(edge?.node && readField('id', edge.node) === entity.id),
          );
          return {
            ...connection,
            edges,
            totalCount: Math.max(
              0,
              (connection.totalCount ?? connection.edges.length) - 1,
            ),
          };
        },
      },
    });
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: `Reindex ${parentId}.${spec.field}`,
    });
  }
}

/** Pagination arguments are not filters, and an empty value filters nothing. */
const PAGINATION_ARGS = new Set([
  'first',
  'last',
  'after',
  'before',
  'orderBy',
]);

/**
 * Whether this cached variant should gain the entity, lose it, or be left alone.
 *
 * `skip` is the answer whenever the variant cannot be decided from the spec —
 * unparseable arguments, or any active filter the spec does not claim
 * competence over.
 */
function decideVariant(
  storeFieldName: string,
  spec: ReindexSpec,
  lifecycle: Lifecycle,
): 'include' | 'exclude' | 'skip' {
  // A removal needs no membership test and gets none. The entity is gone, so
  // it leaves EVERY cached variant — including ones this spec could not decide
  // membership for, because leaving a variant it was never in is a no-op while
  // staying in one it was in is a row on screen that no longer exists.
  //
  // Expressing this as a filter match is what went wrong before: `after: {}`
  // reads as "matches everything" on a variant with no active filters, so a
  // delete ADDED its row to the unfiltered connection.
  if (lifecycle === 'remove') return 'exclude';

  const filters = readFilters(storeFieldName);
  if (filters === 'undecidable') return 'skip';

  // Pagination arguments are part of the store field name but say nothing about
  // membership. Left in, `first: 20` reads as an undecidable filter and every
  // flat variant skips — fail-closed, but uselessly so.
  const active = Object.entries(filters).filter(
    ([key, value]) => !PAGINATION_ARGS.has(key) && isActive(value),
  );
  if (active.some(([key]) => !spec.decidableFilters.includes(key)))
    return 'skip';

  const matches = (values: Record<string, unknown>): boolean =>
    active.every(([key, value]) => values[key] === value);

  if (matches(spec.after)) return 'include';
  // A create was in no variant before, so there is nothing for it to leave.
  if (lifecycle === 'create') return 'skip';
  if (matches(spec.before)) return 'exclude';
  // Belongs to neither — the entity was never in this variant and still is not.
  return 'skip';
}

/**
 * The `filters` argument of a store field name, or `undecidable`.
 *
 * Two shapes, and reading only one of them is how this went wrong: with a
 * `keyArgs` policy InMemoryCache emits `field:{"filters":{…}}` — a COLON and
 * bare JSON — while `field({"filters":{…}})` is the parenthesised form used
 * when arguments are serialized whole. Looking only for `(` made every real
 * variant parse as "no arguments", i.e. unfiltered, and since a membership
 * test over zero active filters is vacuously true, EVERY variant then decided
 * `include`: a toggle added the row to its destination and left it in its
 * source. Verified against `makeCache()` — the key is
 * `itemsConnection:{"filters":{"isPurchased":false}}`.
 */
function readFilters(
  storeFieldName: string,
): Record<string, unknown> | 'undecidable' {
  const parenStart = storeFieldName.indexOf('(');
  const colonStart = storeFieldName.indexOf(':');

  let args: string;
  if (parenStart !== -1) {
    args = storeFieldName.slice(parenStart + 1, -1);
  } else if (colonStart !== -1) {
    args = storeFieldName.slice(colonStart + 1);
  } else {
    // A bare field name is the unfiltered variant: every entity belongs.
    return {};
  }
  if (!args) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(args);
  } catch {
    // Cannot prove anything about this variant, so do not touch it.
    return 'undecidable';
  }

  const raw = parsed as Record<string, unknown> | null;
  const nested = raw?.filters;
  // Filters appear either nested under `filters` or flat on the arguments
  // (`itemsConnection(isPurchased: true)`); both shapes are in use.
  return typeof nested === 'object' && nested !== null
    ? (nested as Record<string, unknown>)
    : raw ?? {};
}

function isActive(value: unknown): boolean {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    !(Array.isArray(value) && value.length === 0)
  );
}

export const __testing = { decideVariant, readFilters, PAGINATION_ARGS };
