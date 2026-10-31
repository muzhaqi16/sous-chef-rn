import type { ApolloCache, Reference } from '@apollo/client';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { hideEntity, isHeld } from '#/apollo/utils/writeLocalEntity';

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
