import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import type { UpdateProfileInput } from '#/graphql/generated/schemaTypes';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { optimisticFieldUpdate } from '#/apollo/utils/optimisticFieldUpdate';
import { errorService } from '#/services/errorService';

/** The result is carried so the caller can resolve LOCALIZED refusal copy. */
export interface UpdateProfileOutcome {
  rejected: boolean;
  result: { data?: unknown; error?: unknown } | undefined;
}

/**
 * Write profile fields locally, then send them. A rejection restores the
 * snapshot; a queued (null) result keeps the write, so it survives offline.
 */
export function useUpdateProfile<T extends { id: string }>(
  profile: T | null | undefined,
) {
  const client = useApolloClient();
  const [updateProfileMutation] = useMutation(UpdateUserProfileDocument);

  const updateProfile = async (
    input: UpdateProfileInput,
  ): Promise<UpdateProfileOutcome> => {
    if (!profile) return { rejected: false, result: undefined };

    const { revert } = optimisticFieldUpdate(
      client.cache,
      client.cache.identify({ __typename: 'UserProfile', id: profile.id }),
      profile,
      input,
      'Update Profile',
    );

    let result;
    try {
      result = await updateProfileMutation({
        variables: { input },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'PersonalInformation.updateProfile',
      });
    }

    if (classifyCreateResult(result) !== 'rejected') {
      return { rejected: false, result };
    }
    revert();
    return { rejected: true, result };
  };

  return { updateProfile };
}
