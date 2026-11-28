import type { UpdateProfileInput } from '#graphql/generated/schemaTypes';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#i18n';
import { updateUserProfileWrite } from '#apollo/pendingWrites/sharedWrites';

/** Profile fields show at once and survive offline; a refusal is alerted. */
export function useUpdateProfile<T extends { id: string }>(
  profile: T | null | undefined,
) {
  const { t } = useTranslation();
  const updateProfileWrite = useLocalWrite(updateUserProfileWrite, {
    fallback: t('errors.updateProfileFailed'),
  });

  const updateProfile = async (input: UpdateProfileInput): Promise<void> => {
    if (!profile) return;

    await updateProfileWrite.send(
      { input },
      {
        entity: { __typename: 'UserProfile', id: profile.id },
        fields: { ...input },
      },
    );
  };

  return { updateProfile };
}
