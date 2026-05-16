import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { alertService } from '#/services/alertService';
import {
  useAppStore,
  useUser,
  useNavigationUtils,
  usePreferences,
} from '#store/useAppStore';
import { useCredentialStorage } from '#hooks/auth/useCredentialStorage';
import { useMutation } from '@apollo/client/react';
import {
  UpdateUserProfileDocument,
  UpdateUserPreferencesDocument,
  type UpdateUserProfileMutation,
} from '#operations/auth/user.generated';
import { ProfileVisibility } from '#/graphql/generated/schemaTypes';

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

export const useConfigurableSettings = (profile: any) => {
  const { t } = useTranslation();
  const user = useUser();
  const logout = useAppStore(state => state.logout);
  const { getUserNavigationState } = useNavigationUtils();
  const { language, setLanguage } = usePreferences();
  const { checkStoredCredentials, getBiometricInfo, removeCredentials } =
    useCredentialStorage();
  const { resetBiometricDeclination, markBiometricEnabled } =
    useAuthPreferences();
  // ===== MUTATION 1: Update User Profile =====
  const [updateProfileMutation] = useMutation(UpdateUserProfileDocument, {
    // Uses automatic normalization - mutation returns full UserProfile fragment
    // No manual cache update needed (Pattern 2)
    optimisticResponse: (variables, { IGNORE }) => {
      if (!profile) return IGNORE;
      const optimistic: UpdateUserProfileMutation = {
        __typename: 'Mutation',
        updateProfile: {
          ...profile,
          ...variables.input,
          __typename: 'UserProfile',
        },
      };
      return optimistic;
    },
    onError: error => {
      console.error('Failed to update profile:', error);
      alertService.alert(
        'Error',
        'Failed to update profile. Please try again.',
      );
    },
  });

  // ===== MUTATION 2: Update User Preferences =====
  const [updateSettingsMutation] = useMutation(UpdateUserPreferencesDocument, {
    // Note: No optimistic response - UserSettings has many required fields that are difficult to predict
    // Automatic normalization handles UI updates when server responds (~100-200ms)
    // No manual cache update needed (Pattern 2)
    onError: error => {
      console.error('Failed to update preferences:', error);
      alertService.alert(
        'Error',
        'Failed to update preferences. Please try again.',
      );
    },
  });

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

  const updateProfile = async (input: Partial<Record<any, any>>) => {
    await executeMutation(
      () => updateProfileMutation({ variables: { input } }),
      'Failed to update profile',
    );
  };

  const updateUserPreferences = (input: any) => {
    updateSettingsMutation({
      variables: {
        input,
      },
    });
    // Don't call store.updatePreferences since it doesn't exist
    // The individual setters will be called instead
  };

  const createSettingItem = (config: any) => {
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

    const baseItem: any = {
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
          onSave: (v: string) =>
            updateProfile({ firstName: v } as Partial<Record<any, any>>),
        };

      case 'lastName':
        return {
          ...baseItem,
          value: profile?.lastName || '',
          onSave: (v: string) =>
            updateProfile({ lastName: v } as Partial<Record<any, any>>),
        };

      case 'displayName':
        return {
          ...baseItem,
          value: profile?.displayName || '',
          onSave: (v: string) =>
            updateProfile({ displayName: v } as Partial<Record<any, any>>),
        };

      case 'bio':
        return {
          ...baseItem,
          value: profile?.bio || '',
          onSave: (v: string) =>
            updateProfile({ bio: v } as Partial<Record<any, any>>),
        };

      case 'phone':
        return {
          ...baseItem,
          value: profile?.phone || '',
          onSave: (v: string) =>
            updateProfile({ phone: v } as Partial<Record<any, any>>),
        };

      case 'website':
        return {
          ...baseItem,
          value: profile?.website || '',
          onSave: (v: string) =>
            updateProfile({ website: v } as Partial<Record<any, any>>),
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
            onSave: (v: string) =>
              updateProfile({ gender: v } as Partial<Record<any, any>>),
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
              updateProfile({ profileVisibility: v } as Partial<
                Record<any, any>
              >),
          };
        }
        break;

      case 'showEmail':
        if (config.type === 'switch') {
          return {
            ...baseItem,
            value: profile?.showEmail || false,
            onPress: () =>
              updateProfile({ showEmail: !profile?.showEmail } as Partial<
                Record<any, any>
              >),
          };
        }
        break;

      case 'showPhone':
        if (config.type === 'switch') {
          return {
            ...baseItem,
            value: profile?.showPhone || false,
            onPress: () =>
              updateProfile({ showPhone: !profile?.showPhone } as Partial<
                Record<any, any>
              >),
          };
        }
        break;

      case 'language':
        if (config.type === 'modal') {
          return {
            ...baseItem,
            value: language || 'en',
            options: SUPPORTED_LANGUAGES,
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
                  'Disable Biometric Authentication',
                  'This will remove your saved credentials. You can re-enable it later.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Disable',
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
                            'Error',
                            'Failed to disable biometric authentication.',
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
            console.log('User logged out');
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
