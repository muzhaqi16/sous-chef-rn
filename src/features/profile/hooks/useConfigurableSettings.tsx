import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { alertService } from '#/services/alertService';
import { logger } from '#/utils/environment';
import { handleMutationError } from '#/utils/errorHandlers';
import {
  useAppStore,
  useUser,
  useNavigationUtils,
  usePreferences,
} from '#store/useAppStore';
import { useCredentialStorage } from '#hooks/auth/useCredentialStorage';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  UpdateUserProfileDocument,
  UpdateUserPreferencesDocument,
  type GetUserProfileQuery,
} from '#operations/auth/user.generated';
import {
  ProfileVisibility,
  type UpdateProfileInput,
  type UpdateSettingsInput,
} from '#/graphql/generated/schemaTypes';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { optimisticFieldUpdate } from '#/apollo/utils/optimisticFieldUpdate';
import type {
  SettingItem,
  SettingOption,
} from '#components/molecules/SettingRow';

import { PROFILE_SETTINGS_CONFIG } from '#/config/settingsConfig';
import { SUPPORTED_LANGUAGES } from '#/i18n/config';
import { dateStringToISO, extractDateString } from '#utils/dateUtils';
import { BiometricSetupModal } from '#components/organisms/BiometricSetupModal';
import { executeMutation, executeQuery } from '#/utils/compilerSafeWrappers';
import { useAuthPreferences } from '#hooks/navigation/useAuthPreferences';

// Map PROFILE_SETTINGS_CONFIG section titles (the config's canonical English
// keys) → translation keys under the `profile.sections` namespace.
const SECTION_TITLE_KEYS: Record<string, string> = {
  'Personal Information': 'profile.sections.personalInformation',
  'Appearance & Language': 'profile.sections.appearanceAndLanguage',
  Notifications: 'profile.sections.notifications',
  'Dietary Profile': 'profile.sections.dietaryProfile',
  'App Settings': 'profile.sections.appSettings',
  Security: 'profile.sections.security',
  Developer: 'profile.sections.developer',
};

// Map PROFILE_SETTINGS_CONFIG item.key → translation key under `profile.labels`.
const ITEM_LABEL_KEYS: Record<string, string> = {
  personalInformation: 'profile.labels.personalInformation',
  appearance: 'profile.labels.appearance',
  language: 'profile.labels.language',
  notifications: 'profile.labels.notifications',
  dietaryProfile: 'profile.labels.dietaryProfile',
  appSettings: 'profile.labels.appSettings',
  biometricAuthentication: 'profile.labels.biometricAuthentication',
  changePassword: 'profile.labels.changePassword',
  debugInfo: 'profile.labels.debugInfo',
  performanceDashboard: 'profile.labels.performanceDashboard',
  logout: 'profile.labels.logout',
};

type UserProfile = NonNullable<
  NonNullable<GetUserProfileQuery['me']>['profile']
>;

// Shape of a single entry inside PROFILE_SETTINGS_CONFIG.
interface SettingConfig {
  key: string;
  label: string;
  type: string;
  subtitle?: string;
  options?: SettingOption[];
}

export const useConfigurableSettings = (profile: UserProfile | null) => {
  const { t } = useTranslation();
  const client = useApolloClient();
  const user = useUser();
  const logout = useAppStore(state => state.logout);
  const { getUserNavigationState } = useNavigationUtils();
  const { language, setLanguage } = usePreferences();
  const { checkStoredCredentials, getBiometricInfo, removeCredentials } =
    useCredentialStorage();
  const { resetBiometricDeclination, markBiometricEnabled } =
    useAuthPreferences();
  // ===== MUTATION 1: Update User Profile =====
  // Local-first: the edited fields are written to the cached UserProfile
  // PERMANENTLY before firing (an optimisticResponse would be torn down the
  // moment the offline queue completes the request with a null result). The
  // update is idempotent server-side (keyed by the authenticated userId), so a
  // queued replay is safe; a real rejection restores the pre-edit values.
  // Error/rejection handling lives in updateProfile/updateUserPreferences below
  // (via alertIfRejected) so there is exactly one alerter — no mutation onError.
  const [updateProfileMutation] = useMutation(UpdateUserProfileDocument);

  // ===== MUTATION 2: Update User Preferences =====
  // No optimistic response — UserSettings has many required fields that are hard
  // to predict; automatic normalization writes the response by id (~100-200ms).
  const [updateSettingsMutation] = useMutation(UpdateUserPreferencesDocument);

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(!!user?.email);

  // Load biometric info on mount
  useEffect(() => {
    if (!user?.email) return;

    const loadBiometricInfo = async () => {
      setBiometricLoading(true);

      const result = await executeQuery(
        () =>
          Promise.all([
            getBiometricInfo(),
            checkStoredCredentials(user?.email),
          ]),
        'Error loading biometric info',
      );

      if (result) {
        const [biometricInfo, hasCredentials] = result;
        setBiometricAvailable(biometricInfo.isAvailable);
        setBiometricType(biometricInfo.biometryType);
        setBiometricEnabled(hasCredentials && biometricInfo.isAvailable);
      }

      setBiometricLoading(false);
    };

    loadBiometricInfo();
  }, [user?.email, getBiometricInfo, checkStoredCredentials]);

  // BiometricSetupModal state
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const handleBiometricModalComplete = async (enabled: boolean) => {
    setShowBiometricModal(false);
    if (enabled) {
      setBiometricEnabled(true);

      // Reset biometric declination state since user manually enabled it
      resetBiometricDeclination();
      markBiometricEnabled();
    } else {
      // Ensure the toggle reflects the current state if setup failed/cancelled
      const hasCredentials = await checkStoredCredentials(user?.email);
      setBiometricEnabled(hasCredentials && biometricAvailable);
    }
  };

  const updateProfile = async (input: UpdateProfileInput) => {
    const cacheId = profile
      ? client.cache.identify({ __typename: 'UserProfile', id: profile.id })
      : undefined;
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
      // Throw path (rare under errorPolicy:'all'): revert + surface. The common
      // resolved-error path is handled by alertIfRejected below.
      error => {
        revert();
        handleMutationError(error, { operation: 'Update Profile' });
      },
    );

    // Rejection (resolved non-success payload) → surface + restore the snapshot.
    // Queued (null payload, no error) keeps the write; the replay is idempotent.
    if (alertIfRejected(result, t('errors.somethingWentWrong'))) {
      revert();
    }
  };

  const updateUserPreferences = async (input: UpdateSettingsInput) => {
    // No optimisticResponse here (UserSettings input is nested and doesn't map
    // 1:1 onto the flat cached entity), so there's nothing to tear down —
    // queueing it offline is safe and the change applies on replay (idempotent,
    // keyed by userId). The individual preference setters drive the local UI.
    // A resolved error member (online) is surfaced; the offline-queued null
    // result is not (alertIfRejected returns false for it).
    const result = await executeMutation(
      () =>
        updateSettingsMutation({
          variables: { input },
          context: { localFirst: true },
        }),
      error => handleMutationError(error, { operation: 'Update Preferences' }),
    );
    alertIfRejected(result, t('errors.somethingWentWrong'));
  };

  const createSettingItem = (config: SettingConfig): SettingItem => {
    // ==== TEST IDs for Detox ====
    const testIDMap: Record<string, string> = {
      personalInformation: 'profile-menu-personalInformation',
      notifications: 'profile-menu-notifications',
      dietaryProfile: 'profile-menu-dietaryProfile',
      appSettings: 'profile-menu-appSettings',
      debugInfo: 'profile-menu-debugInfo',
      performanceDashboard: 'profile-menu-performanceDashboard',
      logout: 'profile-logout-button',
      privacy: 'profile-menu-privacy',
      help: 'profile-menu-help',
      about: 'profile-menu-about',
      feedback: 'profile-menu-feedback',
      changePassword: 'profile-menu-changePassword',
      appearance: 'profile-menu-appearance',
    };

    // Translate well-known labels (Profile screen entries) via i18next; fall
    // back to the config's English string for unmapped keys.
    const translatedLabel = ITEM_LABEL_KEYS[config.key]
      ? t(ITEM_LABEL_KEYS[config.key])
      : config.label;

    const baseItem: SettingItem = {
      key: config.key,
      label: translatedLabel,
      type: config.type,
      ...(testIDMap[config.key] ? { testID: testIDMap[config.key] } : {}),
    };

    // Map configuration keys to actual implementation
    switch (config.key) {
      // Personal Information fields
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

      case 'website':
        return {
          ...baseItem,
          value: profile?.website || '',
          onSave: (v: string) => updateProfile({ website: v }),
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
        if (config.type === 'modal') {
          return {
            ...baseItem,
            value: profile?.gender || '',
            options: config.options || [
              { label: 'Male', value: 'male' },
              { label: 'Female', value: 'female' },
              { label: 'Non-binary', value: 'non-binary' },
              { label: 'Other', value: 'other' },
              { label: 'Prefer not to say', value: 'prefer-not-to-say' },
            ],
            onSave: (v: string) => updateProfile({ gender: v }),
          };
        }
        break;

      // Privacy Settings
      case 'profileVisibility':
        if (config.type === 'modal') {
          return {
            ...baseItem,
            value: profile?.profileVisibility || ProfileVisibility.Public,
            options: config.options || [
              { label: 'Public', value: ProfileVisibility.Public },
              { label: 'Friends Only', value: ProfileVisibility.Friends },
              { label: 'Private', value: ProfileVisibility.Private },
            ],
            onSave: (v: string) =>
              updateProfile({ profileVisibility: v as ProfileVisibility }),
          };
        }
        break;

      case 'showEmail':
        if (config.type === 'switch') {
          return {
            ...baseItem,
            value: profile?.showEmail || false,
            onPress: () => updateProfile({ showEmail: !profile?.showEmail }),
          };
        }
        break;

      case 'showPhone':
        if (config.type === 'switch') {
          return {
            ...baseItem,
            value: profile?.showPhone || false,
            onPress: () => updateProfile({ showPhone: !profile?.showPhone }),
          };
        }
        break;

      case 'language':
        if (config.type === 'modal') {
          return {
            ...baseItem,
            value: language || 'en',
            options: [...SUPPORTED_LANGUAGES],
            onSave: (v: string) => {
              setLanguage(v);
              updateUserPreferences({ regional: { language: v } });
            },
          };
        }
        break;

      // Security Settings
      case 'biometricAuthentication':
        if (config.type === 'switch') {
          const navState = user?.id ? getUserNavigationState(user.id) : null;
          const wasDeclined = navState?.biometricDeclinedPermanently;

          let subtitle: string;
          if (biometricLoading) {
            subtitle = 'Checking availability...';
          } else if (!biometricAvailable) {
            subtitle = 'Not available on this device';
          } else if (wasDeclined && !biometricEnabled) {
            subtitle = `Tap to enable ${biometricType || 'biometric'} login`;
          } else {
            subtitle = `Use ${biometricType || 'biometric'} to login`;
          }

          return {
            ...baseItem,
            value: biometricEnabled,
            disabled: biometricLoading || !biometricAvailable,
            subtitle,
            onPress: async () => {
              if (!biometricAvailable) return;

              if (!biometricEnabled) {
                setShowBiometricModal(true);
              } else {
                alertService.alert(
                  t('biometrics.disableTitle'),
                  t('biometrics.disableBody'),
                  [
                    { text: t('labels.cancel'), style: 'cancel' },
                    {
                      text: t('biometrics.disable'),
                      style: 'destructive',
                      onPress: async () => {
                        const result = await executeMutation(async () => {
                          if (user?.email) {
                            await removeCredentials(user.email);
                            setBiometricEnabled(false);
                          }
                        }, 'Failed to disable biometric authentication');
                        if (result === false) {
                          alertService.alert(
                            t('labels.error'),
                            t('biometrics.disableFailed'),
                          );
                        }
                      },
                    },
                  ],
                );
              }
            },
          };
        }
        break;

      // Navigation items
      case 'personalInformation':
      case 'notifications':
      case 'dietaryProfile':
      case 'appSettings':
      case 'appearance':
      case 'debugInfo':
      case 'performanceDashboard':
      case 'changePassword':
        if (config.type === 'navigation') {
          return {
            ...baseItem,
            onPress: () => {
              // Navigation will be handled in ProfileScreen
              // by checking the type and calling navigate
            },
          };
        }
        break;

      // Action items
      case 'logout':
        return {
          ...baseItem,
          onPress: () => {
            logout();
            logger.debug('User logged out');
          },
        };

      default:
        console.warn(`Unhandled setting key: ${config.key}`);
    }

    return baseItem;
  };

  const sections = (() => {
    return PROFILE_SETTINGS_CONFIG.map(configSection => ({
      // Stable English/canonical key — safe to use for filtering/lookup across
      // locales without depending on the user-visible (translated) title.
      key: configSection.title,
      title: SECTION_TITLE_KEYS[configSection.title]
        ? t(SECTION_TITLE_KEYS[configSection.title])
        : configSection.title,
      items: configSection.items.map(createSettingItem),
    }));
  })();

  const BiometricModal = (
    <BiometricSetupModal
      visible={showBiometricModal}
      onComplete={handleBiometricModalComplete}
      userEmail={user?.email || ''}
      mode="settings"
    />
  );

  return {
    sections,
    BiometricModal,
    biometricLoading,
  };
};
