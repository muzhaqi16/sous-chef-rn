import React, { useState } from 'react';
import { useTranslation } from '#i18n';
import { SettingsSection } from '#components/organisms/SettingsSection';
import type { SettingItem } from '#components/organisms/SettingRow';
import { SubScreen } from '#components/templates/SubScreen';
import { useProfileData } from '#features/profile/hooks/useProfileData';
import { useUser } from '#store/useAppStore';
import {
  PERSONAL_INFO_CONFIG,
  type PersonalInfoItemConfig,
  type SettingOptionConfig,
} from './settingsConfig';
import { getValidationSchemaForField } from '#features/profile/components/profileFieldFormConfig';
import { useUpdateProfile } from '#features/profile/hooks/useUpdateProfile';
import { ProfileVisibility } from '#graphql/generated/schemaTypes';
import { extractDateString } from '#utils/dateUtils';
import { executeRefreshWithFinally } from '#utils/finallyHelpers';
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

  /** What a field shows, and how an edit to it is saved. */
  const bindingOf = (
    key: string,
  ): { value: string; onSave?: (value: string) => void } => {
    switch (key) {
      case 'email':
        return { value: user?.email ?? '' };
      case 'firstName':
        return {
          value: profile?.firstName ?? '',
          onSave: v => {
            void updateProfile({ firstName: v });
          },
        };
      case 'lastName':
        return {
          value: profile?.lastName ?? '',
          onSave: v => {
            void updateProfile({ lastName: v });
          },
        };
      case 'displayName':
        return {
          value: profile?.displayName ?? '',
          onSave: v => {
            void updateProfile({ displayName: v });
          },
        };
      case 'bio':
        return {
          value: profile?.bio ?? '',
          onSave: v => {
            void updateProfile({ bio: v });
          },
        };
      case 'phone':
        return {
          value: profile?.phone ?? '',
          onSave: v => {
            void updateProfile({ phone: v });
          },
        };
      case 'dateOfBirth':
        return {
          value: extractDateString(profile?.dateOfBirth),
          // A calendar date, sent as the YYYY-MM-DD the field validates.
          onSave: v => {
            void updateProfile({ dateOfBirth: v || null });
          },
        };
      case 'gender':
        return {
          value: profile?.gender ?? '',
          onSave: v => {
            void updateProfile({ gender: v });
          },
        };
      case 'profileVisibility':
        return {
          // What the server creates a profile with.
          value: profile?.profileVisibility ?? ProfileVisibility.Private,
          onSave: v => {
            if (isProfileVisibility(v)) {
              void updateProfile({ profileVisibility: v });
            }
          },
        };
      default:
        return { value: '' };
    }
  };

  const createSettingItem = (config: PersonalInfoItemConfig): SettingItem => {
    const base = {
      key: config.key,
      label: t(config.labelKey),
      subtitle: config.subtitleKey ? t(config.subtitleKey) : undefined,
    };
    const { value, onSave } = bindingOf(config.key);
    switch (config.type) {
      case 'text':
        return {
          ...base,
          type: 'text',
          value,
          placeholder: config.placeholderKey
            ? t(config.placeholderKey)
            : undefined,
          validationSchema: getValidationSchemaForField(config.key),
          multiline: config.multiline,
          keyboardType: config.keyboardType,
          onSave,
        };
      case 'modal':
        return {
          ...base,
          type: 'modal',
          value,
          options: translateOptions(config.options),
          onSave,
        };
      case 'info':
        return { ...base, type: 'info', value };
    }
  };

  const sections = (() => {
    return PERSONAL_INFO_CONFIG.map(configSection => ({
      title: configSection.titleKey ? t(configSection.titleKey) : '',
      items: configSection.items.map(createSettingItem),
    }));
  })();

  if (dataState !== 'ready') {
    return (
      <SubScreen title={t('labels.personalInformation')} scroll="none">
        <DataStateView
          state={dataState}
          onRetry={() => {
            // A failed retry lands in the query's `error`, which this view renders.
            refetch().catch(() => {});
          }}
        />
      </SubScreen>
    );
  }

  return (
    <SubScreen
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
    </SubScreen>
  );
};

export default PersonalInformationScreen;
