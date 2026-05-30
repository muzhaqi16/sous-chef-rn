/**
 * Test fixture builders that mirror the production GraphQL document selection
 * for `GetHomes` (HomeListFragment). Tests must match the document selection
 * exactly when seeding via `cache.writeQuery`, otherwise Apollo silently drops
 * unselected fields and the production normalization path breaks.
 *
 * Use these helpers instead of writing flat `{ home: { pantries: [] } }`
 * shapes in tests — that shape never reaches the cache because
 * HomeListFragment selects `pantriesConnection.edges.node`, not `pantries`.
 */

import type { Unmasked } from '@apollo/client/masking';
import {
  InviteStatus,
  MembershipRole,
  MembershipStatus,
} from '#/graphql/generated/schemaTypes';
import type { GetHomesQuery } from '#operations/home/home.generated';

export interface PantryFixture {
  id: string;
  name?: string;
  isDefault?: boolean;
}

export interface HomeFixture {
  id: string;
  name?: string;
  isDefault?: boolean;
  version?: number;
  pantries?: PantryFixture[];
  members?: Array<{
    id: string;
    role?: string;
    status?: string;
    userId?: string;
    displayName?: string;
  }>;
  invites?: Array<{
    id: string;
    email?: string;
    recipientName?: string;
    status?: string;
  }>;
}

// Generic over the literal typename strings so the inferred return preserves
// `__typename: 'MembershipConnection'` (etc.) rather than widening to `string`,
// which lets the builders below satisfy the generated query types.
function connection<TN extends string, ET extends string, T>(
  typename: TN,
  edgeTypename: ET,
  nodes: T[],
) {
  return {
    __typename: typename,
    edges: nodes.map((node, i) => ({
      __typename: edgeTypename,
      cursor: `c${i}`,
      node,
    })),
    pageInfo: {
      __typename: 'PageInfo' as const,
      hasNextPage: false,
      endCursor: null as string | null,
    },
    totalCount: nodes.length,
  };
}

/**
 * Build a single Home node matching HomeListFragment's selection set.
 * Pantries, members, and invites are emitted as proper Connection wrappers
 * so `normalizeHome` (production code) extracts them correctly.
 */
export function homeNode(home: HomeFixture) {
  return {
    __typename: 'Home' as const,
    id: home.id,
    name: home.name ?? `Home ${home.id}`,
    description: null,
    timezone: 'UTC',
    currency: 'USD',
    isPublic: false,
    joinCode: null,
    allowJoinCode: false,
    maxMembers: 10,
    isDefault: home.isDefault ?? false,
    version: home.version ?? 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    membersConnection: connection(
      'MembershipConnection',
      'MembershipEdge',
      (home.members ?? []).map(m => ({
        __typename: 'Membership' as const,
        id: m.id,
        homeId: home.id,
        userId: m.userId ?? `user-${m.id}`,
        role: (m.role as MembershipRole | undefined) ?? MembershipRole.Member,
        status:
          (m.status as MembershipStatus | undefined) ?? MembershipStatus.Active,
        displayName: m.displayName ?? null,
        canManageHome: false,
        canViewPantry: true,
        canEditPantry: true,
        canAddItems: true,
        canRemoveItems: true,
        canInviteOthers: false,
        user: {
          __typename: 'User' as const,
          id: m.userId ?? `user-${m.id}`,
          email: `${m.userId ?? `user-${m.id}`}@example.com`,
        },
      })),
    ),
    invitesConnection: connection(
      'HomeInviteConnection',
      'HomeInviteEdge',
      (home.invites ?? []).map(i => ({
        __typename: 'HomeInvite' as const,
        id: i.id,
        email: i.email ?? `invite-${i.id}@example.com`,
        recipientName: i.recipientName ?? null,
        role: MembershipRole.Member,
        status: (i.status as InviteStatus | undefined) ?? InviteStatus.Pending,
        expiresAt: '2099-01-01T00:00:00Z',
        message: null,
      })),
    ),
    pantriesConnection: connection(
      'PantryConnection',
      'PantryEdge',
      (home.pantries ?? []).map(p => ({
        __typename: 'Pantry' as const,
        id: p.id,
        name: p.name ?? `Pantry ${p.id}`,
        isDefault: p.isDefault ?? false,
      })),
    ),
    myMembership: {
      __typename: 'Membership' as const,
      id: `mm-${home.id}`,
      role: MembershipRole.Owner,
      status: MembershipStatus.Active,
      displayName: null,
      canManageHome: true,
      canViewPantry: true,
      canEditPantry: true,
      canAddItems: true,
      canRemoveItems: true,
      canInviteOthers: true,
    },
  };
}

/**
 * Build the full GetHomes query result. Pass to `cache.writeQuery({ query: GetHomesDocument, data: ... })`
 * or to `recordMock(GetHomesDocument, { data: ... })`.
 */
export function homesData(homes: HomeFixture[]): Unmasked<GetHomesQuery> {
  return {
    __typename: 'Query',
    homes: connection('HomeConnection', 'HomeEdge', homes.map(homeNode)),
  };
}
