/**
 * The `Home` a local-first create writes: the entity every home query reads,
 * plus the creator's Owner membership, plus its place in the homes connection.
 */

import type { ApolloCache, Reference } from '@apollo/client';
import {
  Home_MembershipRowFragmentDoc,
  Home_RowFragmentDoc,
  type Home_MembershipRowFragment,
} from './home.generated';
import {
  NEUTRAL_LOCAL_HOME,
  NEUTRAL_LOCAL_HOME_BY_TYPE,
  NEUTRAL_LOCAL_MEMBERSHIP,
  NEUTRAL_LOCAL_MEMBERSHIP_BY_TYPE,
} from './homeRowNeutral.generated';
import { addToHomesCache } from '#features/home/hooks/homeCacheUpdaters';
import {
  MembershipRole,
  MembershipStatus,
  type CreateHomeInput,
} from '#/graphql/generated/schemaTypes';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import type { Unmasked } from '@apollo/client/masking';

/** The signed-in user, as the membership and its `user` record name them. */
export interface HomeCreator {
  id: string;
  email?: string | null;
  displayName?: string | null;
}

/** The id a placeholder membership carries, derived so it can be found again. */
export const placeholderMembershipId = (homeId: string) => `${homeId}:owner`;

/**
 * Write the home and its creator's membership permanently, then link the home
 * into the homes connection. False when that link could not be made —
 * `cache.modify` reports rather than throws when `Query.homes` is not cached —
 * so the caller can refetch. The entity stands either way.
 */
export function writeLocalHome(
  cache: ApolloCache,
  id: string,
  input: CreateHomeInput,
  creator: HomeCreator,
): boolean {
  // The server mints the real membership, so this one is a PLACEHOLDER keyed
  // off the home, for the replay reconciler to find. Every capability is
  // granted because that is what the server grants a home's owner.
  const membership = {
    __typename: 'Membership',
    id: placeholderMembershipId(id),
  };
  writeLocalEntity(cache, {
    fragment: Home_MembershipRowFragmentDoc,
    fragmentName: 'home_membershipRow',
    neutral: NEUTRAL_LOCAL_MEMBERSHIP,
    neutralByType: NEUTRAL_LOCAL_MEMBERSHIP_BY_TYPE,
    known: {
      ...membership,
      homeId: id,
      userId: creator.id,
      role: MembershipRole.Owner,
      status: MembershipStatus.Active,
      displayName: creator.displayName ?? null,
      canManageHome: true,
      canViewPantry: true,
      canEditPantry: true,
      canAddItems: true,
      canRemoveItems: true,
      canInviteOthers: true,
      user: {
        __typename: 'User',
        id: creator.id,
        email: creator.email ?? null,
        displayName: creator.displayName ?? null,
      },
    },
  });

  const now = new Date().toISOString();
  writeLocalEntity(cache, {
    fragment: Home_RowFragmentDoc,
    fragmentName: 'home_row',
    neutral: NEUTRAL_LOCAL_HOME,
    neutralByType: NEUTRAL_LOCAL_HOME_BY_TYPE,
    known: {
      __typename: 'Home',
      id,
      name: input.name,
      description: input.description ?? null,
      timezone: input.timezone ?? null,
      currency: input.currency ?? null,
      isPublic: input.isPublic ?? false,
      allowJoinCode: input.allowJoinCode ?? false,
      maxMembers: input.maxMembers ?? null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      myMembership: membership,
      membersConnection: {
        __typename: 'MembershipConnection',
        edges: [{ __typename: 'MembershipEdge', node: membership }],
        totalCount: 1,
      },
    },
  });
  // Only the identity: the updater's `toReference(_, true)` WRITES what it is
  // given, and plain field keys would write a second copy of each connection.
  return addToHomesCache(
    cache,
    { __typename: 'Home', id },
    { position: 'end' },
  );
}

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

  const placeholder = cache.readFragment<Unmasked<Home_MembershipRowFragment>>({
    id: cache.identify({ __typename: 'Membership', id: placeholderId }),
    fragment: Home_MembershipRowFragmentDoc,
    fragmentName: 'home_membershipRow',
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
    fragment: Home_MembershipRowFragmentDoc,
    fragmentName: 'home_membershipRow',
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
        if (!connection?.edges) return connection;
        const node = toReference({
          __typename: 'Membership',
          id: serverMembershipId,
        });
        if (!node) return connection;
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
