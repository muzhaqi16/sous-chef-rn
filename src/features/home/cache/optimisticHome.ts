/**
 * The `Home` a local-first create writes: the entity every home query reads,
 * plus the creator's Owner membership, plus its place in the homes connection.
 */

import type { ApolloCache } from '@apollo/client';
import {
  Home_MembershipRowFragmentDoc,
  Home_RowFragmentDoc,
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
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';

/** The signed-in user, as the membership and its `user` record name them. */
export type HomeCreator = {
  id: string;
  email?: string | null;
  displayName?: string | null;
};

/** The id a placeholder membership carries: the server mints the real one. */
export const placeholderMembershipId = (homeId: string) => `${homeId}:owner`;

/** Writes the home and its creator's membership, and lists it in `homes`. */
export function writeLocalHome(
  cache: ApolloCache,
  id: string,
  input: CreateHomeInput,
  creator: HomeCreator,
  now: string,
): void {
  // Every capability is granted because that is what the server grants a
  // home's owner.
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
  addToHomesCache(cache, { __typename: 'Home', id }, { position: 'end' });
}
