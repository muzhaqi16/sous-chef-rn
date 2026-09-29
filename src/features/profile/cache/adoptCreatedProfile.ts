import type { ApolloCache } from '@apollo/client';
import { GetUserProfileDocument } from '#operations/auth/user.generated';
import {
  ProfileVisibility,
  type UpdateProfileInput,
} from '#/graphql/generated/schemaTypes';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';

/** The client cannot key the row the server creates, so a placeholder stands in. */
const localProfileId = (userId: string) => `${userId}:profile`;

/**
 * The first save of an account with no profile: a local row carrying `input`,
 * linked to `me`, so a queued save shows at once. Every field `GetUserProfile`
 * reads is written, at the server's defaults where `input` is silent.
 */
export function writeLocalProfile(
  cache: ApolloCache,
  input: UpdateProfileInput,
): { revert: () => void } {
  const me = cache.readQuery({ query: GetUserProfileDocument })?.me;
  if (!me || me.profile) return { revert: () => {} };

  const placeholderId = localProfileId(me.id);
  cache.writeQuery({
    query: GetUserProfileDocument,
    data: {
      __typename: 'Query',
      me: {
        __typename: 'User',
        id: me.id,
        profile: {
          __typename: 'UserProfile',
          id: placeholderId,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          displayName: input.displayName ?? null,
          bio: input.bio ?? null,
          avatar: input.avatar ?? null,
          phone: input.phone ?? null,
          dateOfBirth: input.dateOfBirth ?? null,
          gender: input.gender ?? null,
          profileVisibility:
            input.profileVisibility ?? ProfileVisibility.Private,
          showEmail: input.showEmail ?? false,
          showPhone: input.showPhone ?? false,
        },
      },
    },
  });

  return {
    revert: () => {
      const linked = cache.readQuery({ query: GetUserProfileDocument })?.me;
      if (linked?.profile?.id === placeholderId) {
        cache.modify({
          id: cache.identify(linked),
          fields: { profile: () => null },
        });
      }
      safeEvict(cache, 'UserProfile', placeholderId);
    },
  };
}

/**
 * `updateProfile` upserts, so an account's first write creates its profile. The
 * payload normalizes by id, but `me.profile` stays null, or on the local
 * placeholder, until pointed at it. Idempotent: a `me` already on a server row
 * is left alone.
 */
export function adoptCreatedProfile(cache: ApolloCache, data: unknown): void {
  const payload: unknown = extractMutationPayload(data);
  const created = isRecord(payload) ? payload.userProfile : undefined;
  const profileId = isRecord(created) ? created.id : undefined;
  if (typeof profileId !== 'string') return;

  const me = cache.readQuery({ query: GetUserProfileDocument })?.me;
  if (!me) return;
  const placeholderId = localProfileId(me.id);
  const linkedId = me.profile?.id;
  if (linkedId && linkedId !== placeholderId) return;

  cache.modify({
    id: cache.identify(me),
    fields: {
      profile: (_existing, { toReference }) =>
        toReference({ __typename: 'UserProfile', id: profileId }),
    },
  });
  if (linkedId) safeEvict(cache, 'UserProfile', placeholderId);
}
