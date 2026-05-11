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

interface ConnectionData<T> {
  __typename: string;
  edges: Array<{ __typename: string; cursor: string; node: T }>;
  pageInfo: { __typename: 'PageInfo'; hasNextPage: boolean; endCursor: string | null };
  totalCount: number;
}

function connection<T>(
  typename: string,
  edgeTypename: string,
  nodes: T[],
): ConnectionData<T> {
  return {
    __typename: typename,
    edges: nodes.map((node, i) => ({
      __typename: edgeTypename,
      cursor: `c${i}`,
      node,
    })),
    pageInfo: {
      __typename: 'PageInfo',
      hasNextPage: false,
      endCursor: null,
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
    __typename: 'Home',
    id: home.id,
    name: home.name ?? `Home ${home.id}`,
    isDefault: home.isDefault ?? false,
    version: home.version ?? 1,
    membersConnection: connection(
      'HomeMembershipConnection',
      'HomeMembershipEdge',
      (home.members ?? []).map(m => ({
        __typename: 'HomeMembership',
        id: m.id,
        role: m.role ?? 'MEMBER',
        status: m.status ?? 'active',
        userId: m.userId ?? `user-${m.id}`,
        displayName: m.displayName ?? null,
      })),
    ),
    invitesConnection: connection(
      'HomeInviteConnection',
      'HomeInviteEdge',
      (home.invites ?? []).map(i => ({
        __typename: 'HomeInvite',
        id: i.id,
        email: i.email ?? null,
        recipientName: i.recipientName ?? null,
        status: i.status ?? 'PENDING',
      })),
    ),
    pantriesConnection: connection(
      'PantryConnection',
      'PantryEdge',
      (home.pantries ?? []).map(p => ({
        __typename: 'Pantry',
        id: p.id,
        name: p.name ?? `Pantry ${p.id}`,
        isDefault: p.isDefault ?? false,
      })),
    ),
    myMembership: {
      __typename: 'HomeMembership',
      id: `mm-${home.id}`,
      role: 'OWNER',
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
export function homesData(homes: HomeFixture[]) {
  return {
    homes: connection(
      'HomeConnection',
      'HomeEdge',
      homes.map(homeNode),
    ),
  };
}
