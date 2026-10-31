import type { ApolloCache, Reference } from '@apollo/client';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import {
  hideEntity,
  isHeld,
  writeLocalEntity,
} from '#/apollo/utils/writeLocalEntity';
import type {
  RestrictionKindInput,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { GetDietaryProfileDocument } from '#operations/user/user.generated';
import {
  NEUTRAL_LOCAL_RESTRICTION,
  NEUTRAL_LOCAL_RESTRICTION_BY_TYPE,
} from './restrictionRowNeutral.generated';
import { Restrictions_RowFragmentDoc } from './restrictions.generated';

export type LocalRestriction = {
  id: string;
  kind: RestrictionKindInput;
  severity: RestrictionSeverity;
  notes?: string | null;
};

/** The person's profile; none until the first write creates it. */
const ownProfileId = (cache: ApolloCache): string | undefined =>
  cache.readQuery({ query: GetDietaryProfileDocument, optimistic: true })?.me
    ?.dietaryProfile?.id;

/** Adds a restriction to the person's profile, once. */
export function listRestriction(cache: ApolloCache, id: string): void {
  const profileId = ownProfileId(cache);
  if (!profileId) return;
  cache.modify({
    id: cache.identify({ __typename: 'DietaryProfile', id: profileId }),
    fields: {
      restrictions(
        existingRestrictions: readonly Reference[] = [],
        { toReference, readField },
      ) {
        const row = toReference({ __typename: 'DietaryRestriction', id });
        return row &&
          !existingRestrictions.some(ref => readField('id', ref) === id)
          ? [...existingRestrictions, row]
          : existingRestrictions;
      },
    },
  });
}

/**
 * Shows a new restriction on the profile. A food the device has never read has
 * no name to show, so that row waits for the answer.
 */
export function showLocalRestriction(
  cache: ApolloCache,
  { id, kind, severity, notes }: LocalRestriction,
  now: string,
): void {
  const item = kind.item ? { __typename: 'Item', id: kind.item } : null;
  if (item && !isHeld(cache, item)) return;
  writeLocalEntity(cache, {
    fragment: Restrictions_RowFragmentDoc,
    fragmentName: 'restrictions_row',
    neutral: NEUTRAL_LOCAL_RESTRICTION,
    neutralByType: NEUTRAL_LOCAL_RESTRICTION_BY_TYPE,
    known: {
      __typename: 'DietaryRestriction',
      id,
      diet: kind.diet ?? null,
      healthGoal: kind.healthGoal ?? null,
      intolerance: kind.intolerance ?? null,
      item,
      severity,
      notes: notes ?? null,
      createdAt: now,
    },
  });
  listRestriction(cache, id);
}

const takeOffProfile = (
  cache: ApolloCache,
  profileId: string,
  restrictionId: string,
): void => {
  cache.modify({
    id: cache.identify({ __typename: 'DietaryProfile', id: profileId }),
    fields: {
      restrictions(
        existingRestrictions: readonly Reference[] = [],
        { readField },
      ) {
        return existingRestrictions.filter(
          ref => readField('id', ref) !== restrictionId,
        );
      },
    },
  });
};

/** Takes a restriction out from a layer. */
export function hideRestriction(
  cache: ApolloCache,
  profileId: string,
  restrictionId: string,
): void {
  const row = { __typename: 'DietaryRestriction', id: restrictionId };
  if (!isHeld(cache, row)) return;
  takeOffProfile(cache, profileId, restrictionId);
  hideEntity(cache, row);
}

/** Takes a removed restriction off its profile and out of the server's data. */
export function dropRestriction(
  cache: ApolloCache,
  profileId: string,
  restrictionId: string,
): void {
  takeOffProfile(cache, profileId, restrictionId);
  safeEvict(cache, 'DietaryRestriction', restrictionId);
}
