import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useStore } from '#store';
import { useTheme, useAuth } from '#hooks';
import { useApolloClient } from '@apollo/client/react';
import {
  useUpdateUserProfileMutation,
  useUpdateUserPreferencesMutation,
  GetUserProfileQuery,
  GetUserProfileDocument,
  ProfileVisibility,
} from '#generated';

import { PROFILE_SETTINGS_CONFIG } from '#config';
import { dateStringToISO, extractDateString } from '#utils/dateUtils';
import { BiometricSetupModal } from '#components/organisms/BiometricSetupModal';
import { useUserPreferences } from '#hooks/navigation/useUserPreferences';

export const useConfigurableSettings = (profile: any) => {
  const store = useStore();
  const client = useApolloClient();
  const { user, logout, getUserNavigationState } = useStore();
  const { userThemePreference, setTheme } = useTheme();
  const { checkStoredCredentials, getBiometricInfo, removeCredentials } =
    useAuth();
  const { resetBiometricDeclination, markBiometricEnabled } =
    useUserPreferences();
  const [updateProfileMutation] = useUpdateUserProfileMutation();
  const [updateSettingsMutation] = useUpdateUserPreferencesMutation();

  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);

  // Load biometric info on mount
  useEffect(() => {
    const loadBiometricInfo = async () => {
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
      }
    };

    if (user?.email) {
      loadBiometricInfo();
    }
  }, [user?.email, getBiometricInfo, checkStoredCredentials]);

  // BiometricSetupModal state
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const handleBiometricModalComplete = useCallback(
    async (enabled: boolean) => {
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
    },
    [
      checkStoredCredentials,
      user?.email,
      biometricAvailable,
      resetBiometricDeclination,
      markBiometricEnabled,
    ],
  );

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

  const updateUserPreferences = useCallback(
    (input: any) => {
      updateSettingsMutation({
        variables: {
          input,
        },
      });
      // Don't call store.updatePreferences since it doesn't exist
      // The individual setters will be called instead
    },
    [updateSettingsMutation],
  );

  const createSettingItem = useCallback(
    (config: any) => {
      const baseItem: any = {
        key: config.key,
        label: config.label,
        type: config.type,
      };

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
            baseItem.onSave = (value: 'LIGHT' | 'DARK' | 'SYSTEM') => {
              // Convert to lowercase for local theme management
              const localThemeValue = value.toLowerCase() as
                | 'light'
                | 'dark'
                | 'system';
              setTheme(localThemeValue);
              // Use uppercase for GraphQL mutation
              updateUserPreferences({ theme: value });
            };
          }
          break;

        // Keep backward compatibility with old darkMode setting
        case 'darkMode':
          if (config.type === 'switch') {
            baseItem.value = userThemePreference === 'dark';
            baseItem.onPress = () => {
              const newTheme =
                userThemePreference === 'dark' ? 'light' : 'dark';
              setTheme(newTheme);
              // Convert to uppercase for GraphQL mutation
              const graphqlThemeValue = newTheme.toUpperCase() as
                | 'LIGHT'
                | 'DARK';
              updateUserPreferences({ theme: graphqlThemeValue });
            };
          }
          break;

        case 'language':
          if (config.type === 'modal') {
            baseItem.value = store.language || 'en';
            baseItem.options = config.options || [
              { label: 'English', value: 'en' },
              { label: 'Spanish', value: 'es' },
              { label: 'French', value: 'fr' },
            ];
            baseItem.onSave = (value: string) => {
              store.setLanguage(value);
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
            baseItem.disabled = !biometricAvailable;

            if (!biometricAvailable) {
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
                          } catch (error) {
                            Alert.alert(
                              'Error',
                              'Failed to disable biometric authentication.',
                            );
                          }
                        },
                      },
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
        case 'notifications':
        case 'dietaryProfile':
        case 'appSettings':
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

      return baseItem;
    },
    [
      profile,
      store,
      user,
      updateProfile,
      updateUserPreferences,
      userThemePreference,
      setTheme,
      logout,
      biometricAvailable,
      biometricEnabled,
      biometricType,
      removeCredentials,
      getUserNavigationState,
    ],
  );

  const sections = useMemo((): any[] => {
    return PROFILE_SETTINGS_CONFIG.map(configSection => ({
      title: configSection.title,
      items: configSection.items.map(createSettingItem),
    }));
  }, [createSettingItem]);

  const BiometricModal = useMemo(
    () => (
      <BiometricSetupModal
        visible={showBiometricModal}
        onComplete={handleBiometricModalComplete}
        userEmail={user?.email || ''}
        mode="settings"
      />
    ),
    [showBiometricModal, handleBiometricModalComplete, user?.email],
  );

  return {
    sections,
    BiometricModal,
  };
};
