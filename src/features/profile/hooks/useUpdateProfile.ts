import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import type { UpdateProfileInput } from '#/graphql/generated/schemaTypes';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { useTranslation } from '#/i18n';

/** Profile fields show at once and survive offline; a refusal is alerted. */
export function useUpdateProfile<T extends { id: string }>(
  profile: T | null | undefined,
) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [updateProfileMutation] = useMutation(UpdateUserProfileDocument, {
    context: { localFirst: true },
  });

  const updateProfile = async (input: UpdateProfileInput): Promise<void> => {
    if (!profile) return;

    await sendFields(client.cache, {
      entity: { __typename: 'UserProfile', id: profile.id },
      fields: { ...input },
      variables: { input },
      mutate: updateProfileMutation,
      settle: {
        document: UpdateUserProfileDocument,
        fallback: t('errors.updateProfileFailed'),
      },
    });
  };

  return { updateProfile };
}
