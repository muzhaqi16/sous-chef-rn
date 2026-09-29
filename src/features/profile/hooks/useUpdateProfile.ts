import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import type { UpdateProfileInput } from '#/graphql/generated/schemaTypes';
import { optimisticFieldUpdate } from '#/apollo/utils/optimisticFieldUpdate';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';

/**
 * Write profile fields locally, then send them. A failure restores the
 * snapshot and is alerted; a queued (null) result keeps the write, so it
 * survives offline.
 */
export function useUpdateProfile<T extends { id: string }>(
  profile: T | null | undefined,
) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [updateProfileMutation] = useMutation(UpdateUserProfileDocument);

  const updateProfile = async (input: UpdateProfileInput): Promise<void> => {
    if (!profile) return;

    const { revert } = optimisticFieldUpdate(
      client.cache,
      client.cache.identify({ __typename: 'UserProfile', id: profile.id }),
      profile,
      input,
      'Update Profile',
    );

    await settleMutation(
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
  };

  return { updateProfile };
}
