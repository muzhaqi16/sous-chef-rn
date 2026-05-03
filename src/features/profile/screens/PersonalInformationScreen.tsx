import React, { useState } from 'react';
import { RefreshControl } from 'react-native';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { useProfileData } from '#features/profile/hooks/useProfileData';
import { useUser } from '#store/useAppStore';
import { PERSONAL_INFO_CONFIG } from '#/config/settingsConfig';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  UpdateUserProfileDocument,
  type UpdateUserProfileMutation,
  type UpdateUserProfileMutationVariables,
} from '#operations/auth/user.generated';
import { ProfileVisibility } from '#/graphql/generated/schemaTypes';
import {
  GetUserProfileDocument,
  type GetUserProfileQuery,
} from '#operations/auth/user.generated';
import { dateStringToISO, extractDateString } from '#utils/dateUtils';
import { errorService } from '#/services/errorService';
import {
  executeMutation,
  executeRefreshWithFinally,
} from '#/utils/compilerSafeWrappers';
import { useUnistyles } from 'react-native-unistyles';

/** Module-level function for profile updates with optimistic cache.
 *  Extracted to avoid try-catch inside component body (React Compiler bailout). */
async function performProfileUpdate(
  client: ReturnType<typeof useApolloClient>,
  updateProfileMutation: useMutation.MutationFunction<
    UpdateUserProfileMutation,
    UpdateUserProfileMutationVariables
  >,
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
        __typename: 'Query',
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

  // Then perform the actual mutation, refetching the profile query to ensure UI stays in sync
  await updateProfileMutation({
    variables: {
      input,
    },
    refetchQueries: [{ query: GetUserProfileDocument }],
  });
}

export const PersonalInformationScreen: React.FC = () => {
  const { profile, refetch } = useProfileData();
  const user = useUser();
  const client = useApolloClient();
  const { theme } = useUnistyles();
  const [updateProfileMutation] = useMutation(UpdateUserProfileDocument);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    executeRefreshWithFinally(() => refetch(), setRefreshing);
  };

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
        return {
          ...baseItem,
          value: profile?.firstName || '',
          onSave: (v: string) => updateProfile({ firstName: v }),
        };

      case 'lastName':
        return {
          ...baseItem,
          value: profile?.lastName || '',
          onSave: (v: string) => updateProfile({ lastName: v }),
        };

      case 'displayName':
        return {
          ...baseItem,
          value: profile?.displayName || '',
          onSave: (v: string) => updateProfile({ displayName: v }),
        };

      case 'bio':
        return {
          ...baseItem,
          value: profile?.bio || '',
          onSave: (v: string) => updateProfile({ bio: v }),
        };

      case 'phone':
        return {
          ...baseItem,
          value: profile?.phone || '',
          onSave: (v: string) => updateProfile({ phone: v }),
        };

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
        return {
          ...baseItem,
          value: profile?.gender || '',
          options: config.options,
          onSave: (v: string) => updateProfile({ gender: v }),
        };

      case 'profileVisibility':
        return {
          ...baseItem,
          value: profile?.profileVisibility || ProfileVisibility.Public,
          options: config.options,
          onSave: (v: string) => updateProfile({ profileVisibility: v }),
        };

      case 'showEmail':
        return {
          ...baseItem,
          value: profile?.showEmail || false,
          onPress: () => updateProfile({ showEmail: !profile?.showEmail }),
        };

      case 'showPhone':
        return {
          ...baseItem,
          value: profile?.showPhone || false,
          onPress: () => updateProfile({ showPhone: !profile?.showPhone }),
        };
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
    <ProfileScreenWrapper
      title="Personal Information"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
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
