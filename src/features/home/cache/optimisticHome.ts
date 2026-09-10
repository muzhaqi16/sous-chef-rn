/**
 * The `Home` a local-first create writes: the entity every home query reads,
 * plus the creator's Owner membership, plus its place in the homes connection.
 */

import { gql, type ApolloCache, type Reference } from '@apollo/client';
import {
  Home_HomeDetailFragmentDoc,
  type Home_HomeDetailFragment,
} from './home.generated';
import { NEUTRAL_HOME_DETAIL } from './homeDetailNeutral.generated';
import { addToHomesCache } from '#features/home/hooks/homeCacheUpdaters';
import {
  MembershipRole,
  MembershipStatus,
  type CreateHomeInput,
} from '#/graphql/generated/schemaTypes';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';

/** The signed-in user, as the membership and its `user` record name them. */
export interface HomeCreator {
  id: string;
  email?: string | null;
  displayName?: string | null;
}

type OptimisticMembership = NonNullable<
  Home_HomeDetailFragment['myMembership']
>;

/**
 * The creator's own membership row. The server mints the real one — the client
 * cannot name its id — so this is a PLACEHOLDER, keyed off the home's id so the
 * replay reconciler can find it. Every capability is granted because that is
 * what the server grants a home's owner, and `homePermissions` reads the cache.
 */
export function buildOptimisticMembership(
  homeId: string,
  creator: HomeCreator,
): OptimisticMembership {
  return {
    __typename: 'Membership',
    id: placeholderMembershipId(homeId),
    role: MembershipRole.Owner,
    status: MembershipStatus.Active,
    displayName: creator.displayName ?? null,
    canManageHome: true,
    canViewPantry: true,
    canEditPantry: true,
    canAddItems: true,
    canRemoveItems: true,
    canInviteOthers: true,
  };
}

/** The id a placeholder membership carries, derived so it can be found again. */
export const placeholderMembershipId = (homeId: string) => `${homeId}:owner`;

/**
 * The whole home under the client-minted id. The neutral base covers every
 * field no create input supplies, so both the list and the detail screen read
 * complete while the create is queued.
 */
export function buildOptimisticHome(
  id: string,
  input: CreateHomeInput,
  creator: HomeCreator,
): Home_HomeDetailFragment {
  const membership = buildOptimisticMembership(id, creator);
  return {
    ...NEUTRAL_HOME_DETAIL,
    id,
    name: input.name,
    description: input.description ?? null,
    timezone: input.timezone ?? null,
    currency: input.currency ?? null,
    isPublic: input.isPublic ?? false,
    allowJoinCode: input.allowJoinCode ?? false,
    maxMembers: input.maxMembers ?? null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    myMembership: membership,
    membersConnection: {
      ...NEUTRAL_HOME_DETAIL.membersConnection,
      edges: [
        {
          __typename: 'MembershipEdge',
          node: {
            ...membership,
            homeId: id,
            userId: creator.id,
            user: {
              __typename: 'User',
              id: creator.id,
              email: creator.email ?? null,
              displayName: creator.displayName ?? null,
            },
          },
        },
      ],
      totalCount: 1,
    },
  };
}

/**
 * Write the home permanently, then link it into the homes connection. False
 * when that link could not be made — `cache.modify` reports rather than throws
 * when `Query.homes` is not cached — so the caller can refetch. The entity
 * stands either way.
 */
export function writeOptimisticHome(
  cache: ApolloCache,
  home: Home_HomeDetailFragment,
): boolean {
  cache.writeFragment({
    id: cache.identify({ __typename: 'Home', id: home.id }),
    fragment: Home_HomeDetailFragmentDoc,
    fragmentName: 'home_homeDetail',
    data: home,
  });
  // Only the identity: the updater's `toReference(_, true)` WRITES what it is
  // given, and an object with plain field keys writes a second, argument-less
  // copy of each connection beside the one above.
  const identity = { __typename: 'Home', id: home.id };
  return addToHomesCache(cache, identity, { position: 'end' });
}

/** The placeholder's own fields, carried onto the row the server minted. */
const AdoptableMembershipFragment = gql`
  fragment _AdoptableMembership on Membership {
    id
    homeId
    userId
    role
    status
    displayName
    canManageHome
    canViewPantry
    canEditPantry
    canAddItems
    canRemoveItems
    canInviteOthers
    user {
      id
      email
      displayName
    }
  }
`;

type AdoptableMembership = { id: string } & Record<string, unknown>;

/**
 * The membership row is the one thing the client cannot key, so the server's
 * REPLACES the placeholder: fields carried over, member edge repointed,
 * placeholder evicted. Runs from the create's `update` online and from the
 * queue's replay reconciler after reconnect; idempotent across a re-drain.
 */
export function adoptServerMembership(
  cache: ApolloCache,
  homeId: string,
  serverMembershipId: string,
): void {
  const placeholderId = placeholderMembershipId(homeId);
  if (!serverMembershipId || serverMembershipId === placeholderId) return;

  const placeholder = cache.readFragment<AdoptableMembership>({
    id: cache.identify({ __typename: 'Membership', id: placeholderId }),
    fragment: AdoptableMembershipFragment,
    fragmentName: '_AdoptableMembership',
  });
  if (!placeholder) return;

  // The server's own selection carries the role and the capability flags but
  // not `status`, `displayName` or the `user` record, so the placeholder's are
  // carried across rather than left missing.
  cache.writeFragment({
    id: cache.identify({
      __typename: 'Membership',
      id: serverMembershipId,
    }),
    fragment: AdoptableMembershipFragment,
    fragmentName: '_AdoptableMembership',
    data: { ...placeholder, id: serverMembershipId },
  });

  repointMemberEdge(cache, homeId, placeholderId, serverMembershipId);
  safeEvict(cache, 'Membership', placeholderId);
}

function repointMemberEdge(
  cache: ApolloCache,
  homeId: string,
  placeholderId: string,
  serverMembershipId: string,
): void {
  const homeCacheId = cache.identify({ __typename: 'Home', id: homeId });
  if (!homeCacheId) return;

  cache.modify({
    id: homeCacheId,
    fields: {
      membersConnection(existing, { readField, toReference }) {
        const connection = existing as
          | { edges?: Array<{ node?: Reference }> }
          | undefined;
        if (!connection?.edges) return existing;
        const node = toReference({
          __typename: 'Membership',
          id: serverMembershipId,
        });
        if (!node) return existing;
        return {
          ...connection,
          edges: connection.edges.map(edge =>
            readField('id', edge.node) === placeholderId
              ? { ...edge, node }
              : edge,
          ),
        };
      },
      myMembership(
        existing: Reference | undefined,
        { readField, toReference },
      ) {
        if (!existing || readField('id', existing) !== placeholderId) {
          return existing;
        }
        return (
          toReference({
            __typename: 'Membership',
            id: serverMembershipId,
          }) ?? existing
        );
      },
    },
  });
}

/** Drop a rejected create: the edge goes with the entity. */
export function revertOptimisticHome(cache: ApolloCache, id: string): void {
  safeEvict(cache, 'Home', id);
  cache.gc();
}
