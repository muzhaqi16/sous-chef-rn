import type { ApolloCache } from '@apollo/client';
import { GetUserProfileDocument } from '#operations/auth/user.generated';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';

/**
 * `updateProfile` upserts, so an account's first write creates its profile. The
 * payload normalizes by id, but `me.profile` stays null until pointed at it.
 * Idempotent: a `me` that already has a profile is left alone.
 */
export function adoptCreatedProfile(cache: ApolloCache, data: unknown): void {
  const payload: unknown = extractMutationPayload(data);
  const created = isRecord(payload) ? payload.userProfile : undefined;
  const profileId = isRecord(created) ? created.id : undefined;
  if (typeof profileId !== 'string') return;

  const me = cache.readQuery({ query: GetUserProfileDocument })?.me;
  if (!me || me.profile) return;

  cache.modify({
    id: cache.identify(me),
    fields: {
      profile: (_existing, { toReference }) =>
        toReference({ __typename: 'UserProfile', id: profileId }),
    },
  });
}
