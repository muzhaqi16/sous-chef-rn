import React, { useState } from 'react';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { useProfileData } from '#features/profile/hooks/useProfileData';
import { useUser } from '#store/useAppStore';
import { PERSONAL_INFO_CONFIG } from '#/config/settingsConfig';
import { useMutation } from '@apollo/client/react';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import { ProfileVisibility } from '#/graphql/generated/schemaTypes';
import { dateStringToISO, extractDateString } from '#utils/dateUtils';
import { errorService } from '#/services/errorService';
import {
  executeMutation,
  executeRefreshWithFinally,
} from '#/utils/compilerSafeWrappers';
import { ThemedRefreshControl } from '#components/atoms/themedComponents';

export const PersonalInformationScreen: React.FC = () => {
  const { profile, refetch } = useProfileData();
  const user = useUser();
  const [updateProfileMutation] = useMutation(UpdateUserProfileDocument);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    executeRefreshWithFinally(() => refetch(), setRefreshing);
  };

  const updateProfile = (input: Partial<Record<any, any>>) => {
    if (!profile) return;
    executeMutation(
      () =>
        updateProfileMutation({
          variables: { input },
          // Apollo auto-normalizes the UserProfile by id from the mutation
          // response, so the cached `me.profile` updates without a refetch.
          optimisticResponse: {
            __typename: 'Mutation',
            updateProfile: {
              __typename: 'UserProfilePayload',
              success: true,
              message: '',
              code: '',
              userProfile: {
                ...profile,
                ...input,
              },
            },
          },
        }),
      error => {
        errorService.reportError(error, {
          operation: 'PersonalInformation.updateProfile',
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
        <ThemedRefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
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
