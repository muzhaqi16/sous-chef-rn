import {useMemo, useCallback} from 'react';
import {useStore} from '#store';
import {useTheme} from '#hooks';
import {useApolloClient} from '@apollo/client';
import {
  useUpdateUserProfileMutation,
  useUpdateUserPreferencesMutation,
  GetUserProfileQuery,
  GetUserProfileDocument,
  ProfileVisibility,
} from '#generated';

import {PROFILE_SETTINGS_CONFIG} from '#config';
import {dateStringToISO, extractDateString} from '#utils/dateUtils';

export const useConfigurableSettings = (profile: any) => {
  const store = useStore();
  const client = useApolloClient();
  const {logout} = useStore();
  const {userThemePreference, setTheme} = useTheme();
  const [updateProfileMutation] = useUpdateUserProfileMutation();
  const [updateSettingsMutation] = useUpdateUserPreferencesMutation();

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
            const updateObj = {firstName: value} as Partial<Record<any, any>>;
            updateProfile(updateObj);
          };
          break;

        case 'lastName':
          baseItem.value = profile?.lastName || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {lastName: value} as Partial<Record<any, any>>;
            updateProfile(updateObj);
          };
          break;

        case 'displayName':
          baseItem.value = profile?.displayName || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {displayName: value} as Partial<Record<any, any>>;
            updateProfile(updateObj);
          };
          break;

        case 'bio':
          baseItem.value = profile?.bio || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {bio: value} as Partial<Record<any, any>>;
            updateProfile(updateObj);
          };
          break;

        case 'phone':
          baseItem.value = profile?.phone || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {phone: value} as Partial<Record<any, any>>;
            updateProfile(updateObj);
          };
          break;

        case 'website':
          baseItem.value = profile?.website || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {website: value} as Partial<Record<any, any>>;
            updateProfile(updateObj);
          };
          break;

        case 'dateOfBirth':
          baseItem.value = extractDateString(profile?.dateOfBirth);
          baseItem.onSave = (value: string) => {
            const isoValue = dateStringToISO(value);
            const updateObj = {dateOfBirth: isoValue};
            updateProfile(updateObj);
          };
          break;

        case 'gender':
          if (config.type === 'modal') {
            baseItem.value = profile?.gender || '';
            baseItem.options = config.options || [
              {label: 'Male', value: 'male'},
              {label: 'Female', value: 'female'},
              {label: 'Non-binary', value: 'non-binary'},
              {label: 'Other', value: 'other'},
              {label: 'Prefer not to say', value: 'prefer-not-to-say'},
            ];
            baseItem.onSave = (value: string) => {
              const updateObj = {gender: value} as Partial<Record<any, any>>;
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
              {label: 'Public', value: ProfileVisibility.Public},
              {label: 'Friends Only', value: ProfileVisibility.Friends},
              {label: 'Private', value: ProfileVisibility.Private},
            ];
            baseItem.onSave = (value: string) => {
              const updateObj = {profileVisibility: value} as Partial<
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
              const updateObj = {showEmail: newValue} as Partial<
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
              const updateObj = {showPhone: newValue} as Partial<
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
              {label: '☀️ Light', value: 'light'},
              {label: '🌙 Dark', value: 'dark'},
              {label: '📱 System', value: 'system'},
            ];
            baseItem.onSave = (value: 'light' | 'dark' | 'system') => {
              setTheme(value);
              updateUserPreferences({theme: value});
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
              updateUserPreferences({theme: newTheme});
            };
          }
          break;

        case 'language':
          if (config.type === 'modal') {
            baseItem.value = store.language || 'en';
            baseItem.options = config.options || [
              {label: 'English', value: 'en'},
              {label: 'Spanish', value: 'es'},
              {label: 'French', value: 'fr'},
            ];
            baseItem.onSave = (value: string) => {
              store.setLanguage(value);
              updateUserPreferences({language: value});
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
      updateProfile,
      updateUserPreferences,
      userThemePreference,
      setTheme,
    ],
  );

  const sections = useMemo((): any[] => {
    return PROFILE_SETTINGS_CONFIG.map(configSection => ({
      title: configSection.title,
      items: configSection.items.map(createSettingItem),
    }));
  }, [createSettingItem]);

  return {
    sections,
  };
};
