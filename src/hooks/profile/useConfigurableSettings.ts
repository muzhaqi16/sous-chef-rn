import {useMemo, useCallback} from 'react';
import {useStore} from '#store';
import {useApolloClient} from '@apollo/client';
import {
  useUpdateProfileMutation,
  useUpdateSettingsMutation,
  UserProfileQuery,
  UserProfileDocument,
  ProfileVisibility,
} from '#generated';
import {
  SettingItem,
  SettingsSection,
  SettingConfig,
  ProfileFieldKey,
} from '#types';
import {PROFILE_SETTINGS_CONFIG} from '#config';
import {dateStringToISO, extractDateString} from '#utils/dateUtils';

export const useConfigurableSettings = (profile: any) => {
  const store = useStore();
  const client = useApolloClient();
  const [updateProfileMutation] = useUpdateProfileMutation();
  const [updateSettingsMutation] = useUpdateSettingsMutation();

  const updateProfile = useCallback(
    async (input: Partial<Record<ProfileFieldKey, any>>) => {
      try {
        // Read current cache
        const cache = client.readQuery<UserProfileQuery>({
          query: UserProfileDocument,
        });

        // Optimistically update the cache immediately
        if (cache?.userProfile) {
          client.writeQuery<UserProfileQuery>({
            query: UserProfileDocument,
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
          include: [UserProfileDocument],
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
    (config: SettingConfig): SettingItem => {
      const baseItem: SettingItem = {
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
            const updateObj = {firstName: value} as Partial<
              Record<ProfileFieldKey, any>
            >;
            updateProfile(updateObj);
          };
          break;

        case 'lastName':
          baseItem.value = profile?.lastName || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {lastName: value} as Partial<
              Record<ProfileFieldKey, any>
            >;
            updateProfile(updateObj);
          };
          break;

        case 'displayName':
          baseItem.value = profile?.displayName || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {displayName: value} as Partial<
              Record<ProfileFieldKey, any>
            >;
            updateProfile(updateObj);
          };
          break;

        case 'bio':
          baseItem.value = profile?.bio || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {bio: value} as Partial<
              Record<ProfileFieldKey, any>
            >;
            updateProfile(updateObj);
          };
          break;

        case 'phone':
          baseItem.value = profile?.phone || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {phone: value} as Partial<
              Record<ProfileFieldKey, any>
            >;
            updateProfile(updateObj);
          };
          break;

        case 'website':
          baseItem.value = profile?.website || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {website: value} as Partial<
              Record<ProfileFieldKey, any>
            >;
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
              const updateObj = {gender: value} as Partial<
                Record<ProfileFieldKey, any>
              >;
              updateProfile(updateObj);
            };
          }
          break;

        // Profile Images
        case 'avatar':
          baseItem.value = profile?.avatar || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {avatar: value} as Partial<
              Record<ProfileFieldKey, any>
            >;
            updateProfile(updateObj);
          };
          break;

        case 'coverImage':
          baseItem.value = profile?.coverImage || '';
          baseItem.onSave = (value: string) => {
            const updateObj = {coverImage: value} as Partial<
              Record<ProfileFieldKey, any>
            >;
            updateProfile(updateObj);
          };
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
                Record<ProfileFieldKey, any>
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
                Record<ProfileFieldKey, any>
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
                Record<ProfileFieldKey, any>
              >;
              updateProfile(updateObj);
            };
          }
          break;

        // Theme & Language settings
        case 'darkMode':
          if (config.type === 'switch') {
            baseItem.value = store.theme === 'dark';
            baseItem.onPress = () => {
              const newTheme = store.theme === 'dark' ? 'light' : 'dark';
              store.setTheme(newTheme);
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

        // Notification settings
        case 'emailNotif':
          if (config.type === 'switch') {
            baseItem.value = store.emailNotifications;
            baseItem.onPress = () => {
              const newValue = !store.emailNotifications;
              store.setEmailNotifications(newValue);
              updateUserPreferences({emailNotifications: newValue});
            };
          }
          break;

        case 'pushNotif':
          if (config.type === 'switch') {
            baseItem.value = store.pushNotifications;
            baseItem.onPress = () => {
              const newValue = !store.pushNotifications;
              store.setNotificationsEnabled(newValue);
              updateUserPreferences({pushNotifications: newValue});
            };
          }
          break;

        // Action items
        case 'logout':
          baseItem.onPress = () => {
            // Call the store's reset method or handle logout logic here
            store.reset();
            // You might want to add additional logout logic here
            // like clearing auth tokens, navigation, etc.
          };
          break;

        default:
          console.warn(`Unhandled setting key: ${config.key}`);
      }

      return baseItem;
    },
    [profile, store, updateProfile, updateUserPreferences],
  );

  const sections = useMemo((): SettingsSection[] => {
    return PROFILE_SETTINGS_CONFIG.map(configSection => ({
      title: configSection.title,
      items: configSection.items.map(createSettingItem),
    }));
  }, [createSettingItem]);

  return {
    sections,
  };
};
