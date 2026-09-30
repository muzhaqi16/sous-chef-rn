import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import type { UpdateProfileInput } from '#/graphql/generated/schemaTypes';
import {
  snapshotFields,
  writeEntityFields,
} from '#/apollo/utils/localFirstFields';
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
  const [updateProfileMutation] = useMutation(UpdateUserProfileDocument, {
    context: { localFirst: true },
  });

  const updateProfile = async (input: UpdateProfileInput): Promise<void> => {
    if (!profile) return;

    const entity = { __typename: 'UserProfile', id: profile.id };
    const previous = snapshotFields(profile, input);
    writeEntityFields(client.cache, entity, input);

    await settleMutation(
      () =>
        updateProfileMutation({
          variables: { input },
        }),
      {
        document: UpdateUserProfileDocument,
        fallback: t('errors.updateProfileFailed'),
        onFailed: () => writeEntityFields(client.cache, entity, previous),
      },
    );
  };

  return { updateProfile };
}
