import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { SettingsSection } from '#components/organisms/SettingsSection';
import type { SettingItem } from '#components/molecules/SettingRow';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { useProfileData } from '#features/profile/hooks/useProfileData';
import { useUser } from '#store/useAppStore';
import {
  PERSONAL_INFO_CONFIG,
  type SettingItemConfig,
  type SettingOptionConfig,
} from '#/config/settingsConfig';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import {
  ProfileVisibility,
  type UpdateProfileInput,
} from '#/graphql/generated/schemaTypes';
import { dateStringToISO, extractDateString } from '#utils/dateUtils';
import { errorService } from '#/services/errorService';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { optimisticFieldUpdate } from '#/apollo/utils/optimisticFieldUpdate';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';

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

    // Rejection restores the snapshot; a queued (null) result keeps the write.
    // `alertIfRejected` stays quiet when the mutation threw — `errorService`
    // above already reported that — so the two never double-report, and a
    // refusal no longer snaps the row back with nothing said.
    if (classifyCreateResult(result) === 'rejected') {
      revert();
      alertIfRejected(result, t('errors.updateProfileFailed'));
    }
  };

  const translateOptions = (options?: SettingOptionConfig[]) =>
    options?.map(opt => ({ value: opt.value, label: t(opt.labelKey) }));

  const createSettingItem = (config: SettingItemConfig): SettingItem => {
    const baseItem: SettingItem = {
      key: config.key,
      label: t(config.labelKey),
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
      title: configSection.titleKey ? t(configSection.titleKey) : '',
      items: configSection.items.map(createSettingItem),
    }));
  })();

  return (
    <ProfileScreenWrapper
      title={t('labels.personalInformation')}
      refreshControl={
        <PlainScrollRefreshControl
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
