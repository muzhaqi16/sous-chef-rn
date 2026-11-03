import { ApolloClient } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import { makeCache } from '#/apollo/cache';
import { FeedScopesDocument } from '#/apollo/feed/feed.generated';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { SyncPageStatus, SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { GetShoppingListItemsFilteredDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  ListFeedChangesDocument,
  ListFeedSnapshotDocument,
} from '#features/shoppingList/offline/listFeed.generated';
import {
  PantryFeedChangesDocument,
  PantryFeedSnapshotDocument,
  PantryFeedSummaryDocument,
} from '#features/pantry/offline/pantryFeed.generated';
import { completeMockedResponse } from './apolloMockProvider';

/**
 * A change feed answered from the schema, for a real client with masking on:
 * a row is as complete as the server's, and a test states only what it asserts.
 */
export const LIST = 'list-1';
export const KIND = SyncScopeKind.ShoppingList;

export interface Scope {
  id: string;
  cursor: string;
}
interface PullInput {
  input: { scopes: { id: string; cursor: string | null }[] };
}
interface SnapshotInput {
  input: { id: string; after?: string | null };
}

export const line = (id: string, isPurchased = false, listId = LIST) => ({
  __typename: 'ShoppingListItem',
  id,
  version: 1,
  purchaseInfo: { isPurchased },
  shoppingList: { id: listId },
});

export const page = (id: string, overrides: Record<string, unknown> = {}) => ({
  scope: { id },
  status: SyncPageStatus.Current,
  cursor: `${id}-next`,
  hasMore: false,
  changed: [],
  removed: [],
  applied: [],
  ...overrides,
});

export const fault = (code = 'INTERNAL_SERVER_ERROR', extensions = {}) => ({
  errors: [
    new GraphQLError('Refused', {
      extensions: { code, disposition: 'RETRY', ...extensions },
    }),
  ],
});

export interface Server {
  scopes: (after: string | null) => unknown;
  pull: (input: PullInput['input']) => unknown;
  snapshot: (input: SnapshotInput['input']) => unknown;
  pantryPull: (input: PullInput['input']) => unknown;
  pantrySnapshot: (input: SnapshotInput['input']) => unknown;
}

export const listed = (scopes: readonly Scope[], hasNextPage = false) => ({
  data: {
    syncScopes: {
      edges: scopes.map(scope => ({ node: { kind: KIND, ...scope } })),
      pageInfo: { hasNextPage, endCursor: hasNextPage ? 'more' : null },
    },
  },
});

export const pulled = (pages: unknown[]) => ({ data: { syncChanges: pages } });

export const wholeList = (
  rows: unknown[],
  overrides: Record<string, unknown> = {},
) => ({
  data: {
    syncSnapshot: {
      status: SyncPageStatus.Current,
      cursor: 'snapshot-cursor',
      endCursor: null,
      hasMore: false,
      rows,
      ...overrides,
    },
  },
});

export const pulls: PullInput['input'][] = [];
export const pantryPulls: PullInput['input'][] = [];
export const summaries: string[] = [];
export const scopeReads: { kinds?: string[] | null }[] = [];
export const snapshots: SnapshotInput['input'][] = [];

/** Answers from the schema, so a row is as complete as the server's. */
export function clientOver(server: Partial<Server>): ApolloClient {
  const mock = (query: never, respond: (variables: never) => unknown) =>
    completeMockedResponse({
      request: { query, variables: () => true },
      maxUsageCount: Number.POSITIVE_INFINITY,
      result: respond as never,
    });
  return new ApolloClient({
    cache: makeCache(),
    dataMasking: true,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: new MockLink([
      mock(
        FeedScopesDocument as never,
        ({ after, kinds }: { after: string | null; kinds?: string[] | null }) => {
          scopeReads.push({ kinds });
          return (server.scopes ?? (() => listed([])))(after ?? null);
        },
      ),
      mock(ListFeedChangesDocument as never, ({ input }: PullInput) => {
        pulls.push(input);
        return (server.pull ?? (() => pulled([])))(input);
      }),
      mock(ListFeedSnapshotDocument as never, ({ input }: SnapshotInput) => {
        snapshots.push(input);
        return (server.snapshot ?? (() => wholeList([])))(input);
      }),
      mock(PantryFeedChangesDocument as never, ({ input }: PullInput) => {
        pantryPulls.push(input);
        return (server.pantryPull ?? (() => pulled([])))(input);
      }),
      mock(PantryFeedSnapshotDocument as never, ({ input }: SnapshotInput) => {
        snapshots.push(input);
        return (server.pantrySnapshot ?? (() => wholeList([])))(input);
      }),
      mock(PantryFeedSummaryDocument as never, ({ id }: { id: string }) => {
        summaries.push(id);
        return { data: { pantry: { __typename: 'Pantry', id } } };
      }),
    ]),
  });
}

export const itemsOf = (
  client: ApolloClient,
  isPurchased: boolean,
  id = LIST,
) =>
  client.cache
    .readQuery({
      query: GetShoppingListItemsFilteredDocument,
      variables: { id, first: 50, isPurchased },
    })
    ?.shoppingList?.itemsConnection.edges.map(edge => edge.node.id);
