import React from 'react';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { useProfileData } from '#hooks/profile/useProfileData';
import { useAuthUser } from '#hooks/auth/useAuthUser';
import { PERSONAL_INFO_CONFIG } from '#/config/settingsConfig';
import { useUpdateUserProfileMutation, ProfileVisibility } from '#generated';
import { useApolloClient } from '@apollo/client/react';
import { GetUserProfileQuery, GetUserProfileDocument } from '#generated';
import { dateStringToISO, extractDateString } from '#utils/dateUtils';
import { errorService } from '#/services/errorService';
import { executeMutation } from '#/utils/compilerSafeWrappers';

/** Module-level function for profile updates with optimistic cache.
 *  Extracted to avoid try-catch inside component body (React Compiler bailout). */
async function performProfileUpdate(
  client: ReturnType<typeof useApolloClient>,
  updateProfileMutation: ReturnType<typeof useUpdateUserProfileMutation>[0],
  input: Partial<Record<any, any>>,
): Promise<void> {
  // Read current cache
  const cache = client.readQuery<GetUserProfileQuery>({
    query: GetUserProfileDocument,
  });

  // Optimistically update the cache immediately
  if (cache?.me?.profile) {
    client.writeQuery<GetUserProfileQuery>({
      query: GetUserProfileDocument,
      data: {
        __typename: 'Query' as const,
        me: {
          ...cache.me,
          profile: {
            ...cache.me.profile,
            ...input,
          },
        },
      },
    });
  }

  // Then perform the actual mutation
  await updateProfileMutation({
    variables: {
      input,
    },
  });
}

export const PersonalInformationScreen: React.FC = () => {
  const { profile } = useProfileData();
  const user = useAuthUser();
  const client = useApolloClient();
  const [updateProfileMutation] = useUpdateUserProfileMutation();

  const updateProfile = (input: Partial<Record<any, any>>) => {
    executeMutation(
      () => performProfileUpdate(client, updateProfileMutation, input),
      error => {
        errorService.reportError(error, {
          operation: 'PersonalInformation.updateProfile',
        });
        // On error, refetch to restore correct state
        client.refetchQueries({
          include: [GetUserProfileDocument],
        });
      },
    );
  };

  const createSettingItem = (config: any) => {
    const baseItem: any = {
      key: config.key,
      label: config.label,
      type: config.type,
    };

    switch (config.key) {
      case 'email':
        return { ...baseItem, value: user?.email || '' };

      case 'firstName':
        return { ...baseItem, value: profile?.firstName || '', onSave: (v: string) => updateProfile({ firstName: v }) };

      case 'lastName':
        return { ...baseItem, value: profile?.lastName || '', onSave: (v: string) => updateProfile({ lastName: v }) };

      case 'displayName':
        return { ...baseItem, value: profile?.displayName || '', onSave: (v: string) => updateProfile({ displayName: v }) };

      case 'bio':
        return { ...baseItem, value: profile?.bio || '', onSave: (v: string) => updateProfile({ bio: v }) };

      case 'phone':
        return { ...baseItem, value: profile?.phone || '', onSave: (v: string) => updateProfile({ phone: v }) };

      case 'dateOfBirth':
        return {
          ...baseItem,
          value: extractDateString(profile?.dateOfBirth),
          onSave: (v: string) => {
            const isoValue = dateStringToISO(v);
            updateProfile({ dateOfBirth: isoValue });
          },
        };

      case 'gender':
        return { ...baseItem, value: profile?.gender || '', options: config.options, onSave: (v: string) => updateProfile({ gender: v }) };

      case 'profileVisibility':
        return { ...baseItem, value: profile?.profileVisibility || ProfileVisibility.Public, options: config.options, onSave: (v: string) => updateProfile({ profileVisibility: v }) };

      case 'showEmail':
        return { ...baseItem, value: profile?.showEmail || false, onPress: () => updateProfile({ showEmail: !profile?.showEmail }) };

      case 'showPhone':
        return { ...baseItem, value: profile?.showPhone || false, onPress: () => updateProfile({ showPhone: !profile?.showPhone }) };
    }

    return baseItem;
  };

  const sections = (() => {
    return PERSONAL_INFO_CONFIG.map(configSection => ({
      title: configSection.title,
      items: configSection.items.map(createSettingItem),
    }));
  })();

  return (
    <ProfileScreenWrapper title="Personal Information">
      {sections.map((section, index) => (
        <SettingsSection
          key={`section-${index}`}
          title={section.title}
          items={section.items}
        />
      ))}
    </ProfileScreenWrapper>
  );
};

export default PersonalInformationScreen;
