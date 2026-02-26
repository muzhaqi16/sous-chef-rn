import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useShallow } from 'zustand/shallow';
import {
  useAppStore,
  selectUser,
  selectSetters,
  selectNavigationUtils,
  selectPreferences } from '#store/useAppStore';
import { useTheme } from '#hooks/useTheme';
import { useAuth } from '#hooks/auth/useAuth';
import {
  useUpdateUserProfileMutation,
  useUpdateUserPreferencesMutation,
  ProfileVisibility } from '#generated';
import { ThemePreference } from '#store/slices/preferencesSlice';

import { PROFILE_SETTINGS_CONFIG } from '#/config/settingsConfig';
import { dateStringToISO, extractDateString } from '#utils/dateUtils';
import { BiometricSetupModal } from '#components/organisms/BiometricSetupModal';
import { useUserPreferences } from '#hooks/navigation/useUserPreferences';

export const useConfigurableSettings = (profile: any) => {
  const user = useAppStore(selectUser);
  const { logout } = useAppStore(useShallow(selectSetters));
  const { getUserNavigationState } = useAppStore(
    useShallow(selectNavigationUtils),
  );
  const { language, setLanguage } = useAppStore(useShallow(selectPreferences));
  const { userThemePreference, setTheme } = useTheme();
  const { checkStoredCredentials, getBiometricInfo, removeCredentials } =
    useAuth();
  const { resetBiometricDeclination, markBiometricEnabled } =
    useUserPreferences();
  // ===== MUTATION 1: Update User Profile =====
  const [updateProfileMutation] = useUpdateUserProfileMutation({
    errorPolicy: 'all',
    // Uses automatic normalization - mutation returns full UserProfile fragment
    // No manual cache update needed (Pattern 2)
    optimisticResponse: (variables, { IGNORE }) => {
      if (!profile) return IGNORE;

      return {
        __typename: 'Mutation',
        updateProfile: {
          ...profile,
          ...variables.input,
          __typename: 'UserProfile' } };
    },
    onError: error => {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } });

  // ===== MUTATION 2: Update User Preferences =====
  const [updateSettingsMutation] = useUpdateUserPreferencesMutation({
    errorPolicy: 'all',
    // Note: No optimistic response - UserSettings has many required fields that are difficult to predict
    // Automatic normalization handles UI updates when server responds (~100-200ms)
    // No manual cache update needed (Pattern 2)
    onError: error => {
      console.error('Failed to update preferences:', error);
      Alert.alert('Error', 'Failed to update preferences. Please try again.');
    } });

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(true);

  // Load biometric info on mount
  useEffect(() => {
    const loadBiometricInfo = async () => {
      setBiometricLoading(true);
      try {
        const [biometricInfo, hasCredentials] = await Promise.all([
          getBiometricInfo(),
          checkStoredCredentials(user?.email),
        ]);

        setBiometricAvailable(biometricInfo.isAvailable);
        setBiometricType(biometricInfo.biometryType);
        setBiometricEnabled(hasCredentials && biometricInfo.isAvailable);
      } catch (error) {
        console.error('Error loading biometric info:', error);
      } finally {
        setBiometricLoading(false);
      }
    };

    if (user?.email) {
      loadBiometricInfo();
    } else {
      setBiometricLoading(false);
    }
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
      try {
        // Mutation uses automatic normalization + optimistic response
        // No manual cache update needed (Pattern 2)
        await updateProfileMutation({
          variables: {
            input } });
      } catch (error) {
        // Error handled by onError handler in mutation options
        console.error('Failed to update profile:', error);
      }
    };

  const updateUserPreferences = (input: any) => {
      updateSettingsMutation({
        variables: {
          input } });
      // Don't call store.updatePreferences since it doesn't exist
      // The individual setters will be called instead
    };

  const createSettingItem = (config: any) => {
      const baseItem: any = {
        key: config.key,
        label: config.label,
        type: config.type };

      // Map configuration keys to actual implementation
      switch (config.key) {
        // Personal Information fields
        case 'firstName':
          baseItem.value = profile?.firstName || '';
          baseItem.onSave = (value: string) => {
            const updateObj = { firstName: value } as Partial<Record<any, any>>;
            updateProfile(updateObj);
          };
          break;

        case 'lastName':
          baseItem.value = profile?.lastName || '';
          baseItem.onSave = (value: string) => {
            const updateObj = { lastName: value } as Partial<Record<any, any>>;
            updateProfile(updateObj);
          };
          break;

        case 'displayName':
          baseItem.value = profile?.displayName || '';
          baseItem.onSave = (value: string) => {
            const updateObj = { displayName: value } as Partial<
              Record<any, any>
            >;
            updateProfile(updateObj);
          };
          break;

        case 'bio':
          baseItem.value = profile?.bio || '';
          baseItem.onSave = (value: string) => {
            const updateObj = { bio: value } as Partial<Record<any, any>>;
            updateProfile(updateObj);
          };
          break;

        case 'phone':
          baseItem.value = profile?.phone || '';
          baseItem.onSave = (value: string) => {
            const updateObj = { phone: value } as Partial<Record<any, any>>;
            updateProfile(updateObj);
          };
          break;

        case 'website':
          baseItem.value = profile?.website || '';
          baseItem.onSave = (value: string) => {
            const updateObj = { website: value } as Partial<Record<any, any>>;
            updateProfile(updateObj);
          };
          break;

        case 'dateOfBirth':
          baseItem.value = extractDateString(profile?.dateOfBirth);
          baseItem.onSave = (value: string) => {
            const isoValue = dateStringToISO(value);
            const updateObj = { dateOfBirth: isoValue };
            updateProfile(updateObj);
          };
          break;

        case 'gender':
          if (config.type === 'modal') {
            baseItem.value = profile?.gender || '';
            baseItem.options = config.options || [
              { label: 'Male', value: 'male' },
              { label: 'Female', value: 'female' },
              { label: 'Non-binary', value: 'non-binary' },
              { label: 'Other', value: 'other' },
              { label: 'Prefer not to say', value: 'prefer-not-to-say' },
            ];
            baseItem.onSave = (value: string) => {
              const updateObj = { gender: value } as Partial<Record<any, any>>;
              updateProfile(updateObj);
            };
          }
          break;

        // Privacy Settings
        case 'profileVisibility':
          if (config.type === 'modal') {
            baseItem.value =
              profile?.profileVisibility || ProfileVisibility.Public;
            baseItem.options = config.options || [
              { label: 'Public', value: ProfileVisibility.Public },
              { label: 'Friends Only', value: ProfileVisibility.Friends },
              { label: 'Private', value: ProfileVisibility.Private },
            ];
            baseItem.onSave = (value: string) => {
              const updateObj = { profileVisibility: value } as Partial<
                Record<any, any>
              >;
              updateProfile(updateObj);
            };
          }
          break;

        case 'showEmail':
          if (config.type === 'switch') {
            baseItem.value = profile?.showEmail || false;
            baseItem.onPress = () => {
              const newValue = !profile?.showEmail;
              const updateObj = { showEmail: newValue } as Partial<
                Record<any, any>
              >;
              updateProfile(updateObj);
            };
          }
          break;

        case 'showPhone':
          if (config.type === 'switch') {
            baseItem.value = profile?.showPhone || false;
            baseItem.onPress = () => {
              const newValue = !profile?.showPhone;
              const updateObj = { showPhone: newValue } as Partial<
                Record<any, any>
              >;
              updateProfile(updateObj);
            };
          }
          break;

        // Theme & Language settings
        case 'theme':
          if (config.type === 'modal') {
            baseItem.value = userThemePreference;
            baseItem.options = config.options || [
              { label: '☀️ Light', value: 'LIGHT' },
              { label: '🌙 Dark', value: 'DARK' },
              { label: '📱 System', value: 'SYSTEM' },
            ];
            baseItem.onSave = (value: ThemePreference) => {
              setTheme(value);
              updateUserPreferences({ theme: value });
            };
          }
          break;

        // Keep backward compatibility with old darkMode setting
        case 'darkMode':
          if (config.type === 'switch') {
            baseItem.value = userThemePreference === 'DARK';
            baseItem.onPress = () => {
              const newTheme =
                userThemePreference === ThemePreference.DARK
                  ? ThemePreference.LIGHT
                  : ThemePreference.DARK;
              setTheme(newTheme);
              updateUserPreferences({ theme: newTheme });
            };
          }
          break;

        case 'language':
          if (config.type === 'modal') {
            baseItem.value = language || 'en';
            baseItem.options = config.options || [
              { label: 'English', value: 'en' },
              { label: 'Spanish', value: 'es' },
              { label: 'French', value: 'fr' },
            ];
            baseItem.onSave = (value: string) => {
              setLanguage(value);
              updateUserPreferences({ language: value });
            };
          }
          break;

        // Security Settings
        case 'biometricAuthentication':
          if (config.type === 'switch') {
            const navState = user?.id ? getUserNavigationState(user.id) : null;
            const wasDeclined = navState?.biometricDeclinedPermanently;

            baseItem.value = biometricEnabled;
            baseItem.disabled = biometricLoading || !biometricAvailable;

            if (biometricLoading) {
              baseItem.subtitle = 'Checking availability...';
            } else if (!biometricAvailable) {
              baseItem.subtitle = 'Not available on this device';
            } else if (wasDeclined && !biometricEnabled) {
              baseItem.subtitle = `Tap to enable ${
                biometricType || 'biometric'
              } login`;
            } else {
              baseItem.subtitle = `Use ${
                biometricType || 'biometric'
              } to login`;
            }

            baseItem.onPress = async () => {
              if (!biometricAvailable) return;

              try {
                if (!biometricEnabled) {
                  // Show BiometricSetupModal for enabling authentication
                  setShowBiometricModal(true);
                } else {
                  // Disable biometric authentication
                  Alert.alert(
                    'Disable Biometric Authentication',
                    'This will remove your saved credentials. You can re-enable it later.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Disable',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            if (user?.email) {
                              await removeCredentials(user.email);
                              setBiometricEnabled(false);
                            }
                          } catch {
                            Alert.alert(
                              'Error',
                              'Failed to disable biometric authentication.',
                            );
                          }
                        } },
                    ],
                  );
                }
              } catch (error) {
                if (error instanceof Error && error.message !== 'Cancelled') {
                  console.error('Biometric setting error:', error);
                  Alert.alert('Error', 'Failed to update biometric settings.');
                }
              }
            };
          }
          break;

        // Navigation items
        case 'personalInformation':
        case 'notifications':
        case 'dietaryProfile':
        case 'appSettings':
        case 'debugInfo':
        case 'performanceDashboard':
        case 'changePassword':
          if (config.type === 'navigation') {
            baseItem.onPress = () => {
              // Navigation will be handled in ProfileScreen
              // by checking the type and calling navigate
            };
          }
          break;

        // Action items
        case 'logout':
          baseItem.onPress = () => {
            // Call the store's reset method or handle logout logic here
            logout();
            // You might want to add additional logout logic here
            // like clearing auth tokens, navigation, etc.
            console.log('User logged out');
          };
          break;

        default:
          console.warn(`Unhandled setting key: ${config.key}`);
      }

      // ==== TEST IDs for Detox ====
      switch (config.key) {
        case 'personalInformation':
          baseItem.testID = 'profile-menu-personalInformation';
          break;

        case 'notifications':
          baseItem.testID = 'profile-menu-notifications';
          break;

        case 'dietaryProfile':
          baseItem.testID = 'profile-menu-dietaryProfile';
          break;

        case 'appSettings':
          baseItem.testID = 'profile-menu-appSettings';
          break;

        case 'debugInfo':
          baseItem.testID = 'profile-menu-debugInfo';
          break;

        case 'performanceDashboard':
          baseItem.testID = 'profile-menu-performanceDashboard';
          break;

        case 'logout':
          baseItem.testID = 'profile-logout-button';
          break;

        // Optional menu/test cases
        case 'privacy':
          baseItem.testID = 'profile-menu-privacy';
          break;

        case 'help':
          baseItem.testID = 'profile-menu-help';
          break;

        case 'about':
          baseItem.testID = 'profile-menu-about';
          break;

        case 'feedback':
          baseItem.testID = 'profile-menu-feedback';
          break;
      }

      return baseItem;
    };

  const sections = (() => {
    return PROFILE_SETTINGS_CONFIG.map(configSection => ({
      title: configSection.title,
      items: configSection.items.map(createSettingItem) }));
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
    biometricLoading };
};
