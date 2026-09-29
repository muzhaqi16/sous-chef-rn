import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import type { UpdateProfileInput } from '#/graphql/generated/schemaTypes';
import { optimisticFieldUpdate } from '#/apollo/utils/optimisticFieldUpdate';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { adoptCreatedProfile } from '#features/profile/cache/adoptCreatedProfile';
import { useTranslation } from '#/i18n';

/**
 * Write profile fields locally, then send them. A failure restores the
 * snapshot and is alerted; a queued (null) result keeps the write, so it
 * survives offline. With no profile yet there is nothing to write locally:
 * `updateProfile` upserts, and the row it creates is linked to `me`.
 */
export function useUpdateProfile<T extends { id: string }>(
  profile: T | null | undefined,
) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [updateProfileMutation] = useMutation(UpdateUserProfileDocument);

  const updateProfile = async (input: UpdateProfileInput): Promise<void> => {
    const { revert } = optimisticFieldUpdate(
      client.cache,
      profile
        ? client.cache.identify({ __typename: 'UserProfile', id: profile.id })
        : undefined,
      profile,
      input,
      'Update Profile',
    );

    const settled = await settleMutation(
      () =>
        updateProfileMutation({
          variables: { input },
          context: { localFirst: true },
        }),
      {
        document: UpdateUserProfileDocument,
        fallback: t('errors.updateProfileFailed'),
        onFailed: revert,
      },
    );
    if (settled.status === 'applied') {
      adoptCreatedProfile(client.cache, settled.data);
    }
  };

  return { updateProfile };
}
