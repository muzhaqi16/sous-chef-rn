import type { TypePolicies } from '@apollo/client';
import type { FieldFunctionOptions } from '@apollo/client';
import {
  mergeConnectionByNodeId,
  itemsConnectionFieldPolicy,
  readByIdFromCache,
} from '#/apollo/cacheFieldPolicies';
import type { CachedConnection, CachedEdge } from '#/apollo/cacheFieldPolicies';
import { isRecord } from '#/utils/isRecord';

/**
 * The pantry's cache shape: windowed item connections keyed on what partitions
 * them, and by-id redirects so a locally-created row reads before the server
 * has it.
 */
export const pantryTypePolicies: TypePolicies = {
  Pantry: {
    fields: {
      itemsConnection: {
        ...itemsConnectionFieldPolicy(),
        // Keyed on every filter but `today`, which only moves the expiring
        // window: keying on it would leave the expiring list a cache miss the
        // next day, offline included, and a stranded entry per day.
        keyArgs: (args: Record<string, unknown> | null) => {
          const filters = args?.filters;
          if (!isRecord(filters) || !('today' in filters)) {
            return ['filters', 'orderBy'];
          }
          return [
            'filters',
            Object.keys(filters).filter(key => key !== 'today'),
            'orderBy',
          ];
        },
      },
      storageLocationsConnection: mergeConnectionByNodeId(['orderBy']),
      // `today` only moves the expiring window; keying on it would empty a warm
      // cache at midnight.
      suggestions: {
        keyArgs: ['limit', 'expirationDays'],
        merge(existing: unknown, incoming: unknown) {
          if (incoming == null) return existing;
          return incoming;
        },
      },
      // `true` is Apollo's shorthand for `mergeObjects(existing, incoming)`.
      // Unkeyed: a write made on one day must land on the entry `GetPantry`
      // reads after midnight moves its `today`.
      stats: {
        keyArgs: false,
        merge: true,
      },
    },
  },
  PantryItem: {
    merge: true, // Enable automatic field-level merging for partial data
    fields: {
      unit: {
        merge: false, // Always replace unit with incoming data, never merge
      },
      // The amount as shown is one value: a new one replaces the old whole.
      displayAmount: {
        merge: false,
      },
      // Without a policy, keyArgs is every argument and a `fetchMore` page
      // lands under its own cursor — the list never grows.
      usageRecordsConnection: mergeConnectionByNodeId(['orderBy']),
    },
  },
  Query: {
    fields: {
      pantry: readByIdFromCache('Pantry'),
      // `canRead` checks only that the entity exists: a `PantryItem` short one
      // `PantryItemDetail_pantryItem` field still goes to the network, so this
      // needs a detail-complete optimistic write.
      pantryItem: readByIdFromCache('PantryItem'),
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
        // Apollo's dangling-ref filtering skips `edge.node` in a connection:
        // without this read an evicted node leaves the query incomplete, and
        // offline `usePreservedNodes` freezes the pre-delete list.
        read(
          existing: CachedConnection | undefined,
          { canRead }: FieldFunctionOptions,
        ) {
          if (!existing?.edges?.length) return existing;
          const validEdges = existing.edges.filter((edge: CachedEdge) =>
            edge.node ? canRead(edge.node) : false,
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
        merge(existing: unknown = [], incoming: unknown) {
          if (incoming == null) {
            return existing;
          }
          return incoming;
        },
      },
    },
  },
};
