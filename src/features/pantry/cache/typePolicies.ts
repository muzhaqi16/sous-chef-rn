import type { TypePolicies } from '@apollo/client';
import type { FieldFunctionOptions } from '@apollo/client';
import {
  mergeConnectionByNodeId,
  itemsConnectionFieldPolicy,
} from '#/apollo/cacheFieldPolicies';
import type { CachedConnection, CachedEdge } from '#/apollo/cacheFieldPolicies';

/**
 * The pantry's cache shape: windowed item connections keyed on what actually partitions them, and by-id redirects so a locally-created row is readable before the server has it.
 *
 * Merged into the cache by `makeCache()`, which throws rather than let two
 * features silently overwrite each other on the same field.
 */
export const pantryTypePolicies: TypePolicies = {
  Pantry: {
    fields: {
      itemsConnection: itemsConnectionFieldPolicy(['filters', 'orderBy']),
      storageLocationsConnection: mergeConnectionByNodeId(),
      suggestions: {
        merge(existing = [], incoming) {
          if (incoming == null) return existing;
          return incoming;
        },
      },
      stats: {
        merge(existing, incoming, { mergeObjects }) {
          return mergeObjects(existing, incoming);
        },
      },
    },
  },
  PantryItem: {
    merge: true, // Enable automatic field-level merging for partial data
    fields: {
      unit: {
        merge: false, // Always replace unit with incoming data, never merge
      },
      // Without a policy, keyArgs is every argument and a `fetchMore` page
      // lands under its own cursor — the list never grows.
      usageRecords: mergeConnectionByNodeId(['orderBy']),
    },
  },
  Query: {
    fields: {
      pantry: {
        read(
          existing: unknown,
          { args, toReference, canRead }: FieldFunctionOptions,
        ) {
          if (existing !== undefined) return existing;
          const ref = toReference({
            __typename: 'Pantry',
            id: args?.id as string,
          });
          return canRead(ref) ? ref : existing;
        },
      },
      // The redirect is all-or-nothing: `canRead` only checks that the
      // entity EXISTS, so a `PantryItem` missing one field of
      // `PantryItemDetail_pantryItem` still reads incomplete and Apollo
      // goes to the network. It therefore only pays off paired with a
      // detail-complete optimistic write —
      // `optimisticEntityCompleteness.test.ts` is what keeps that true.
      pantryItem: {
        read(
          existing: unknown,
          { args, toReference, canRead }: FieldFunctionOptions,
        ) {
          if (existing !== undefined) return existing;
          const ref = toReference({
            __typename: 'PantryItem',
            id: args?.id as string,
          });
          return canRead(ref) ? ref : existing;
        },
      },
      pantries: {
        // Different homes have different pantries - cache separately
        keyArgs: ['homeId'],
        merge(existing = [], incoming) {
          if (incoming == null) {
            return existing;
          }
          return incoming;
        },
      },
      // Batches for a pantry item are a Relay connection keyed by the item
      // (and optional status filter), so each item — and each active/all
      // view — keeps its own cached edge list; edges merge by node id.
      pantryItemBatchesConnection: mergeConnectionByNodeId([
        'pantryItemId',
        'status',
      ]),
      storageLocations: {
        // Different homes have different storage locations - cache separately
        keyArgs: ['homeId'],
        // A connection, not a list, so Apollo's broken-ref filtering never
        // reaches `edge.node`. Without this read an optimistic delete's
        // evict leaves a dangling node, the query goes incomplete, and
        // offline `usePreservedNodes` freezes the PRE-delete list.
        read(
          existing: CachedConnection | undefined,
          { canRead }: FieldFunctionOptions,
        ) {
          if (!existing?.edges?.length) return existing;
          const validEdges = existing.edges.filter((edge: CachedEdge) =>
            edge?.node ? canRead(edge.node) : false,
          );
          if (validEdges.length === existing.edges.length) return existing;
          const dropped = existing.edges.length - validEdges.length;
          return {
            ...existing,
            edges: validEdges,
            totalCount:
              typeof existing.totalCount === 'number'
                ? Math.max(0, existing.totalCount - dropped)
                : existing.totalCount,
          };
        },
        merge(existing = [], incoming) {
          if (incoming == null) {
            return existing;
          }
          return incoming;
        },
      },
      storageLocationTree: {
        // Different homes have different storage location trees - cache separately
        keyArgs: ['homeId'],
        merge(existing = [], incoming) {
          if (incoming == null) {
            return existing;
          }
          return incoming;
        },
      },
      pantryItemSuggestions: {
        // Different pantries have different suggestions - cache separately
        // Note: 'limit' excluded from keyArgs to avoid unnecessary cache fragmentation
        keyArgs: ['pantryId'],
        merge(existing = [], incoming) {
          if (incoming == null) {
            return existing;
          }
          return incoming;
        },
      },
    },
  },
};
