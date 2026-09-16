import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { SettingsSection } from '#components/organisms/SettingsSection';
import type { SettingItem } from '#components/organisms/SettingRow';
import { ProfileScreenWrapper } from '#components/templates/ProfileScreenWrapper';
import { useProfileData } from '#features/profile/hooks/useProfileData';
import { useUser } from '#store/useAppStore';
import {
  PERSONAL_INFO_CONFIG,
  type SettingItemConfig,
  type SettingOptionConfig,
} from '#/config/settingsConfig';
import { useUpdateProfile } from '#features/profile/hooks/useUpdateProfile';
import { ProfileVisibility } from '#/graphql/generated/schemaTypes';
import { dateStringToISO, extractDateString } from '#utils/dateUtils';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { useDataState } from '#hooks/data/useDataState';
import { DataStateView } from '#components/organisms/DataStateView';

const PROFILE_VISIBILITIES: ReadonlySet<string> = new Set(
  Object.values(ProfileVisibility),
);

// The picker hands back a string; only a member the schema defines is sent.
const isProfileVisibility = (value: string): value is ProfileVisibility =>
  PROFILE_VISIBILITIES.has(value);

export const PersonalInformationScreen: React.FC = () => {
  const { t } = useTranslation();
  const { profile, loading, error, refetch } = useProfileData();
  const user = useUser();
  // A refused write reverts and is alerted inside the hook.
  const { updateProfile } = useUpdateProfile(profile);
  const [refreshing, setRefreshing] = useState(false);

  // Every write needs the profile's id, so a screen without one would show
  // blank fields whose edits go nowhere.
  const dataState = useDataState({
    loading,
    error,
    hasResult: profile !== null,
    isEmpty: false,
  });

  const handleRefresh = () => {
    void executeRefreshWithFinally(() => refetch(), setRefreshing);
  };

  const translateOptions = (options?: SettingOptionConfig[]) =>
    options?.map(opt => ({ value: opt.value, label: t(opt.labelKey) }));

  const createSettingItem = (config: SettingItemConfig): SettingItem => {
    const baseItem: SettingItem = {
      key: config.key,
      label: t(config.labelKey),
      type: config.type,
      placeholder: config.placeholderKey ? t(config.placeholderKey) : undefined,
    };

    switch (config.key) {
      case 'email':
        return { ...baseItem, value: user?.email ?? '' };

      case 'firstName':
        return {
          ...baseItem,
          value: profile?.firstName ?? '',
          onSave: (v: string) => {
            void updateProfile({ firstName: v });
          },
        };

      case 'lastName':
        return {
          ...baseItem,
          value: profile?.lastName ?? '',
          onSave: (v: string) => {
            void updateProfile({ lastName: v });
          },
        };

      case 'displayName':
        return {
          ...baseItem,
          value: profile?.displayName ?? '',
          onSave: (v: string) => {
            void updateProfile({ displayName: v });
          },
        };

      case 'bio':
        return {
          ...baseItem,
          value: profile?.bio ?? '',
          onSave: (v: string) => {
            void updateProfile({ bio: v });
          },
        };

      case 'phone':
        return {
          ...baseItem,
          value: profile?.phone ?? '',
          onSave: (v: string) => {
            void updateProfile({ phone: v });
          },
        };

      case 'dateOfBirth':
        return {
          ...baseItem,
          value: extractDateString(profile?.dateOfBirth),
          onSave: (v: string) => {
            const isoValue = dateStringToISO(v);
            void updateProfile({ dateOfBirth: isoValue });
          },
        };

      case 'gender':
        return {
          ...baseItem,
          value: profile?.gender ?? '',
          options: translateOptions(config.options),
          onSave: (v: string) => {
            void updateProfile({ gender: v });
          },
        };

      case 'profileVisibility':
        return {
          ...baseItem,
          value: profile?.profileVisibility ?? ProfileVisibility.Public,
          options: translateOptions(config.options),
          onSave: (v: string) => {
            if (isProfileVisibility(v)) {
              void updateProfile({ profileVisibility: v });
            }
          },
        };

      case 'showEmail':
        return {
          ...baseItem,
          value: profile?.showEmail ?? false,
          onPress: () => {
            void updateProfile({ showEmail: !profile?.showEmail });
          },
        };

      case 'showPhone':
        return {
          ...baseItem,
          value: profile?.showPhone ?? false,
          onPress: () => {
            void updateProfile({ showPhone: !profile?.showPhone });
          },
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

  if (dataState !== 'ready') {
    return (
      <ProfileScreenWrapper
        title={t('labels.personalInformation')}
        scrollEnabled={false}
      >
        <DataStateView
          state={dataState}
          onRetry={() => {
            // A failed retry lands in the query's `error`, which this view renders.
            refetch().catch(() => {});
          }}
        />
      </ProfileScreenWrapper>
    );
  }

  return (
    <ProfileScreenWrapper
      title={t('labels.personalInformation')}
      refresh={{ refreshing, onRefresh: handleRefresh }}
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
