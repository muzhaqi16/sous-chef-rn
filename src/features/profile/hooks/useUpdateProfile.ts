import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import type { UpdateProfileInput } from '#graphql/generated/schemaTypes';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#i18n';

/** Profile fields show at once and survive offline; a refusal is alerted. */
export function useUpdateProfile<T extends { id: string }>(
  profile: T | null | undefined,
) {
  const { t } = useTranslation();
  const updateProfileWrite = useLocalWrite(UpdateUserProfileDocument, {
    fallback: t('errors.updateProfileFailed'),
  });

  const updateProfile = async (input: UpdateProfileInput): Promise<void> => {
    if (!profile) return;

    await updateProfileWrite.sendFields({
      entity: { __typename: 'UserProfile', id: profile.id },
      fields: { ...input },
      variables: { input },
    });
  };

  return { updateProfile };
}
