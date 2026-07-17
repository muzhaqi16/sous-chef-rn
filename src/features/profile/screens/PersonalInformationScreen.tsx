import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsSection } from '#components/organisms/SettingsSection';
import type {
  SettingItem,
  SettingOption,
} from '#components/molecules/SettingRow';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { useProfileData } from '#features/profile/hooks/useProfileData';
import { useUser } from '#store/useAppStore';
import { PERSONAL_INFO_CONFIG } from '#/config/settingsConfig';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import {
  ProfileVisibility,
  type UpdateProfileInput,
} from '#/graphql/generated/schemaTypes';
import { dateStringToISO, extractDateString } from '#utils/dateUtils';
import { errorService } from '#/services/errorService';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { optimisticFieldUpdate } from '#/apollo/utils/optimisticFieldUpdate';
import {
  executeMutation,
  executeRefreshWithFinally,
} from '#/utils/compilerSafeWrappers';
import { ThemedRefreshControl } from '#components/atoms/themedComponents';

const SECTION_TITLE_KEYS: Record<string, string> = {
  'Personal Information': 'personalInformation.sectionPersonalInformation',
  'Privacy Settings': 'personalInformation.sectionPrivacySettings',
};

const FIELD_LABEL_KEYS: Record<string, string> = {
  email: 'personalInformation.email',
  firstName: 'personalInformation.firstName',
  lastName: 'personalInformation.lastName',
  displayName: 'personalInformation.displayName',
  bio: 'personalInformation.bio',
  phone: 'personalInformation.phone',
  dateOfBirth: 'personalInformation.dateOfBirth',
  gender: 'personalInformation.gender',
  profileVisibility: 'personalInformation.profileVisibility',
  showEmail: 'personalInformation.showEmail',
  showPhone: 'personalInformation.showPhone',
};

const OPTION_LABEL_KEYS: Record<string, string> = {
  Male: 'personalInformation.genderMale',
  Female: 'personalInformation.genderFemale',
  'Non-binary': 'personalInformation.genderNonBinary',
  Other: 'personalInformation.genderOther',
  'Prefer not to say': 'personalInformation.genderPreferNotToSay',
  Public: 'personalInformation.visibilityPublic',
  'Friends Only': 'personalInformation.visibilityFriendsOnly',
  Private: 'personalInformation.visibilityPrivate',
};

// Shape of a single entry inside PERSONAL_INFO_CONFIG.
interface SettingConfig {
  key: string;
  label: string;
  type: string;
  options?: SettingOption[];
}

export const PersonalInformationScreen: React.FC = () => {
  const { t } = useTranslation();
  const { profile, refetch } = useProfileData();
  const user = useUser();
  const client = useApolloClient();
  const [updateProfileMutation] = useMutation(UpdateUserProfileDocument);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    executeRefreshWithFinally(() => refetch(), setRefreshing);
  };

  const updateProfile = async (input: UpdateProfileInput) => {
    if (!profile) return;
    const cacheId = client.cache.identify({
      __typename: 'UserProfile',
      id: profile.id,
    });
    const { revert } = optimisticFieldUpdate(
      client.cache,
      cacheId,
      profile,
      input,
      'Update Profile',
    );

    const result = await executeMutation(
      () =>
        updateProfileMutation({
          variables: { input },
          context: { localFirst: true },
        }),
      error => {
        errorService.reportError(error, {
          operation: 'PersonalInformation.updateProfile',
        });
      },
    );

    // Rejection restores the snapshot; a queued (null) result keeps the write.
    if (
      classifyCreateResult(
        result || null,
        'updateProfile',
        'UpdateProfilePayload',
      ) === 'rejected'
    ) {
      revert();
    }
  };

  const translateOptions = (
    options?: Array<{ label: string; value: string }>,
  ) =>
    options?.map(opt => ({
      ...opt,
      label: OPTION_LABEL_KEYS[opt.label]
        ? t(OPTION_LABEL_KEYS[opt.label])
        : opt.label,
    }));

  const createSettingItem = (config: SettingConfig): SettingItem => {
    const baseItem: SettingItem = {
      key: config.key,
      label: FIELD_LABEL_KEYS[config.key]
        ? t(FIELD_LABEL_KEYS[config.key])
        : config.label,
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
          options: translateOptions(config.options),
          onSave: (v: string) => updateProfile({ gender: v }),
        };

      case 'profileVisibility':
        return {
          ...baseItem,
          value: profile?.profileVisibility || ProfileVisibility.Public,
          options: translateOptions(config.options),
          onSave: (v: string) =>
            updateProfile({ profileVisibility: v as ProfileVisibility }),
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
      title: SECTION_TITLE_KEYS[configSection.title]
        ? t(SECTION_TITLE_KEYS[configSection.title])
        : configSection.title,
      items: configSection.items.map(createSettingItem),
    }));
  })();

  return (
    <ProfileScreenWrapper
      title={t('personalInformation.screenTitle')}
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
