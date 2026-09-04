import React, { useState, useEffect } from 'react';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { logger } from '#/utils/environment';
import { handleMutationError } from '#/utils/errorHandlers';
import {
  useUser,
  useNavigationUtils,
  usePreferences,
} from '#store/useAppStore';
import { authService } from '#/services/authService';
import { useCredentialStorage } from '#features/profile/hooks/useCredentialStorage';
import { useMutation } from '@apollo/client/react';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { type UpdateSettingsInput } from '#/graphql/generated/schemaTypes';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import type { SettingItem } from '#components/organisms/SettingRow';

import {
  PROFILE_SETTINGS_CONFIG,
  type SettingItemConfig,
} from '#/config/settingsConfig';
import { SUPPORTED_LANGUAGES } from '#/i18n/config';
import { BiometricSetupModal } from '#features/profile/components/BiometricSetupModal';
import { errorService } from '#/services/errorService';
import { useAuthPreferences } from '#hooks/navigation/useAuthPreferences';

/**
 * Builds the profile screen's setting rows. Takes no profile — every row here
 * navigates, toggles biometrics, changes language or signs out; the rows that
 * render UserProfile fields live in PersonalInformationScreen.
 */
export const useConfigurableSettings = () => {
  const { t } = useTranslation();
  const user = useUser();
  const { getUserNavigationState } = useNavigationUtils();
  const { language, setLanguage } = usePreferences();
  const { checkStoredCredentials, getBiometricInfo, removeCredentials } =
    useCredentialStorage();
  const { resetBiometricDeclination, markBiometricEnabled } =
    useAuthPreferences();
  // No optimistic response — UserSettings has many required fields that are
  // hard to predict; normalization writes the response by id. Rejections are
  // alerted in `updateUserPreferences` below, the single alerter, so this
  // mutation deliberately carries no `onError`.
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

      // The try body stays plain statements — a `&&`/`?.`/ternary inside a try
      // makes the React Compiler bail out of this whole hook. See
      // scripts/probe-compiler-try-forms.mjs.
      const email = user?.email;
      let loaded:
        | [Awaited<ReturnType<typeof getBiometricInfo>>, boolean]
        | undefined;
      try {
        loaded = await Promise.all([
          getBiometricInfo(),
          checkStoredCredentials(email),
        ]);
      } catch (error) {
        // Leaving `loaded` undefined keeps the biometric flags at their
        // defaults — an unreadable keychain must not present biometrics as
        // available.
        errorService.reportError(error, {
          operation: 'Error loading biometric info',
        });
      }

      if (loaded) {
        const [biometricInfo, hasCredentials] = loaded;
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

  const updateUserPreferences = async (input: UpdateSettingsInput) => {
    // No optimisticResponse here (UserSettings input is nested and doesn't map
    // 1:1 onto the flat cached entity), so there's nothing to tear down —
    // queueing it offline is safe and the change applies on replay (idempotent,
    // keyed by userId). The individual preference setters drive the local UI.
    // A resolved error member (online) is surfaced; the offline-queued null
    // result is not (alertIfRejected returns false for it).
    let result;
    try {
      result = await updateSettingsMutation({
        variables: { input },
        context: { localFirst: true },
      });
    } catch (error) {
      handleMutationError(error, { operation: 'Update Preferences' });
    }
    alertIfRejected(result, t('errors.codes.genericRetry'));
  };

  const createSettingItem = (config: SettingItemConfig): SettingItem => {
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
    const baseItem: SettingItem = {
      key: config.key,
      label: t(config.labelKey),
      type: config.type,
      ...(testIDMap[config.key] ? { testID: testIDMap[config.key] } : {}),
    };

    // Map configuration keys to actual implementation
    switch (config.key) {
      // The personal-information fields (firstName, gender, showEmail, …) are
      // NOT handled here. They belong to PERSONAL_INFO_CONFIG, which
      // PersonalInformationScreen renders with its own builder; this hook only
      // ever sees PROFILE_SETTINGS_CONFIG. Eleven such cases sat here
      // unreachable, two of them carrying untranslated English option lists.

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
          // `biometricType` is a device-reported name (Face ID, Touch ID)
          // and stays as-is; only the sentence around it is translated.
          const method = biometricType || t('biometrics.genericMethod');
          if (biometricLoading) {
            subtitle = t('biometrics.checkingAvailability');
          } else if (!biometricAvailable) {
            subtitle = t('biometrics.notAvailable');
          } else if (wasDeclined && !biometricEnabled) {
            subtitle = t('biometrics.tapToEnable', { method });
          } else {
            subtitle = t('biometrics.useToLogin', { method });
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
                        const email = user?.email;
                        try {
                          if (email) {
                            // Server first, while the session that authorises
                            // it is live; then the local slot.
                            await authService.revokeDeviceCredentialForThisDevice();
                            await removeCredentials(email);
                            setBiometricEnabled(false);
                          }
                        } catch (error) {
                          errorService.reportError(error, {
                            operation:
                              'Failed to disable biometric authentication',
                          });
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
            // `authService.logout` and not the store's own `logout` action:
            // the store action resets state but never deregisters the device
            // for push, hands the offline queue its owner change, or removes
            // the persisted queue/navigation keys. Two sign-out paths that
            // each clear a different subset is how the shared-device residue
            // got there; this is the only one.
            const signOut = () => {
              // Keeps the biometric credential: signing back in after a
              // deliberate sign-out is exactly what it exists for, and the
              // refresh-token lineage this revokes cannot serve that.
              void authService.logout({ keepBiometricCredentials: true });
              logger.debug('User logged out');
            };

            // A deliberate sign-out DELETES the queue
            // (`queueManager.onLogout`), so prompt only when there is something
            // to lose; an empty queue stays a one-tap sign-out.
            const pendingCount = queueStore.getPendingCount();
            if (pendingCount === 0) {
              signOut();
              return;
            }

            alertService.alert(
              t('profile.labels.logout'),
              t('confirmations.logoutWithPending', { count: pendingCount }),
              [
                { text: t('labels.cancel'), style: 'cancel' },
                {
                  text: t('profile.labels.logout'),
                  style: 'destructive',
                  onPress: signOut,
                },
              ],
            );
          },
        };

      default:
        logger.warn(`Unhandled setting key: ${config.key}`);
    }

    return baseItem;
  };

  const sections = (() => {
    return PROFILE_SETTINGS_CONFIG.map(configSection => ({
      // Stable id, independent of the user-visible (translated) title.
      key: configSection.id,
      title: configSection.titleKey ? t(configSection.titleKey) : '',
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
