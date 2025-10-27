import React, { useMemo, useCallback } from 'react';
import { SettingsSection } from '#components';
import { ProfileScreenWrapper } from '#components/templates';
import { useProfileData } from '#hooks';
import { PERSONAL_INFO_CONFIG } from '#config';
import { useUpdateUserProfileMutation, ProfileVisibility } from '#generated';
import { useApolloClient } from '@apollo/client/react';
import { GetUserProfileQuery, GetUserProfileDocument } from '#generated';
import { dateStringToISO, extractDateString } from '#utils/dateUtils';

export const PersonalInformationScreen: React.FC = () => {
  const { profile } = useProfileData();
  const client = useApolloClient();
  const [updateProfileMutation] = useUpdateUserProfileMutation();

  const updateProfile = useCallback(
    async (input: Partial<Record<any, any>>) => {
      try {
        // Read current cache
        const cache = client.readQuery<GetUserProfileQuery>({
          query: GetUserProfileDocument,
        });

        // Optimistically update the cache immediately
        if (cache?.userProfile) {
          client.writeQuery<GetUserProfileQuery>({
            query: GetUserProfileDocument,
            data: {
              userProfile: {
                ...cache.userProfile,
                ...input,
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
      } catch (error) {
        console.error('Failed to update profile:', error);
        // On error, refetch to restore correct state
        client.refetchQueries({
          include: [GetUserProfileDocument],
        });
      }
    },
    [updateProfileMutation, client],
  );

  const createSettingItem = useCallback(
    (config: any) => {
      const baseItem: any = {
        key: config.key,
        label: config.label,
        type: config.type,
      };

      switch (config.key) {
        case 'firstName':
          baseItem.value = profile?.firstName || '';
          baseItem.onSave = (value: string) => updateProfile({ firstName: value });
          break;

        case 'lastName':
          baseItem.value = profile?.lastName || '';
          baseItem.onSave = (value: string) => updateProfile({ lastName: value });
          break;

        case 'displayName':
          baseItem.value = profile?.displayName || '';
          baseItem.onSave = (value: string) => updateProfile({ displayName: value });
          break;

        case 'bio':
          baseItem.value = profile?.bio || '';
          baseItem.onSave = (value: string) => updateProfile({ bio: value });
          break;

        case 'phone':
          baseItem.value = profile?.phone || '';
          baseItem.onSave = (value: string) => updateProfile({ phone: value });
          break;

        case 'dateOfBirth':
          baseItem.value = extractDateString(profile?.dateOfBirth);
          baseItem.onSave = (value: string) => {
            const isoValue = dateStringToISO(value);
            updateProfile({ dateOfBirth: isoValue });
          };
          break;

        case 'gender':
          baseItem.value = profile?.gender || '';
          baseItem.options = config.options;
          baseItem.onSave = (value: string) => updateProfile({ gender: value });
          break;

        case 'profileVisibility':
          baseItem.value = profile?.profileVisibility || ProfileVisibility.Public;
          baseItem.options = config.options;
          baseItem.onSave = (value: string) => updateProfile({ profileVisibility: value });
          break;

        case 'showEmail':
          baseItem.value = profile?.showEmail || false;
          baseItem.onPress = () => updateProfile({ showEmail: !profile?.showEmail });
          break;

        case 'showPhone':
          baseItem.value = profile?.showPhone || false;
          baseItem.onPress = () => updateProfile({ showPhone: !profile?.showPhone });
          break;
      }

      return baseItem;
    },
    [profile, updateProfile],
  );

  const sections = useMemo(() => {
    return PERSONAL_INFO_CONFIG.map(configSection => ({
      title: configSection.title,
      items: configSection.items.map(createSettingItem),
    }));
  }, [createSettingItem]);

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
