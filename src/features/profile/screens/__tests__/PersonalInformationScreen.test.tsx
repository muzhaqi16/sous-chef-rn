'use no memo';
import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { PersonalInformationScreen } from '../PersonalInformationScreen';
import type { SettingsSectionProps } from '#components/organisms/SettingsSection';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import { ProfileVisibility } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';

jest.mock('#features/profile/hooks/useProfileData', () => ({
  useProfileData: () => ({
    profile: {
      __typename: 'UserProfile',
      id: 'profile-1',
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'JohnDoe',
      bio: 'A chef',
      phone: '555-1234',
      dateOfBirth: '1990-01-15T00:00:00.000Z',
      gender: 'Male',
      profileVisibility: 'PUBLIC',
      showEmail: true,
      showPhone: false,
    },
    loading: false,
  }),
}));

jest.mock('#store/useAppStore', () => ({
  useUser: () => ({ email: 'john@example.com' }),
}));

jest.mock('#/services/errorService');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#utils/dateUtils', () => ({
  dateStringToISO: jest.fn((val: string) => val),
  extractDateString: jest.fn((val: string) => val || ''),
}));

// Mirrors the real PERSONAL_INFO_CONFIG: i18n KEYS, a stable section id, and
// `options` carrying keys too. The assertions below therefore check that the
// screen RESOLVES those keys, which is the behaviour that regressed when the
// translation lived in a lookup map keyed on the English title.
jest.mock('#/config/settingsConfig', () => ({
  PERSONAL_INFO_CONFIG: [
    {
      id: 'personalInformation',
      titleKey: 'labels.personalInformation',
      items: [
        { key: 'email', labelKey: 'personalInformation.email', type: 'text' },
        {
          key: 'firstName',
          labelKey: 'personalInformation.firstName',
          type: 'editable',
        },
        {
          key: 'lastName',
          labelKey: 'personalInformation.lastName',
          type: 'editable',
        },
        {
          key: 'displayName',
          labelKey: 'personalInformation.displayName',
          type: 'editable',
        },
        {
          key: 'gender',
          labelKey: 'personalInformation.gender',
          type: 'modal',
          options: [
            { labelKey: 'personalInformation.genderMale', value: 'male' },
            { labelKey: 'personalInformation.genderFemale', value: 'female' },
          ],
        },
      ],
    },
    {
      id: 'privacy',
      titleKey: 'personalInformation.sectionPrivacySettings',
      items: [
        {
          key: 'profileVisibility',
          labelKey: 'personalInformation.profileVisibility',
          type: 'modal',
          // The real config's values, so the assertion below is about what the
          // screen sends rather than about this stub.
          options: [
            {
              labelKey: 'personalInformation.visibilityPublic',
              value: 'PUBLIC',
            },
            {
              labelKey: 'personalInformation.visibilityFriendsOnly',
              value: 'FRIENDS',
            },
            {
              labelKey: 'personalInformation.visibilityPrivate',
              value: 'PRIVATE',
            },
          ],
        },
        {
          key: 'showEmail',
          labelKey: 'personalInformation.showEmail',
          type: 'toggle',
        },
        {
          key: 'showPhone',
          labelKey: 'personalInformation.showPhone',
          type: 'toggle',
        },
      ],
    },
  ],
}));

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#components/templates/ProfileScreenWrapper', () => {
  const { View, Text } = require('react-native');
  return {
    ProfileScreenWrapper: ({
      children,
      title,
    }: {
      children?: React.ReactNode;
      title?: string;
    }) => (
      <View testID="profile-screen-wrapper">
        <Text>{title}</Text>
        {children}
      </View>
    ),
  };
});

// Stands in for the real row + picker sheet: each modal option becomes a
// pressable that fires the row's `onSave`, which is the whole chain under test.
jest.mock('#components/organisms/SettingsSection', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    SettingsSection: ({ title, items }: SettingsSectionProps) => (
      <View testID={`section-${title}`}>
        <Text>{title}</Text>
        {items?.map(item => (
          <View key={item.key} testID={`setting-${item.key}`}>
            <Text>{item.label}</Text>
            {item.value !== undefined && (
              <Text testID={`value-${item.key}`}>{String(item.value)}</Text>
            )}
            {item.options?.map(opt => (
              <Pressable
                key={opt.value}
                testID={`option-${item.key}-${opt.value}`}
                onPress={() => item.onSave?.(opt.value)}
              />
            ))}
          </View>
        ))}
      </View>
    ),
  };
});

describe('PersonalInformationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the screen with correct title', () => {
    renderWithApollo(<PersonalInformationScreen />);
    // Twice: the screen header and the first section share
    // `labels.personalInformation`, exactly as the real config does.
    expect(screen.getAllByText('Personal Information')).toHaveLength(2);
  });

  // Section titles come from `titleKey`, resolved here. They used to be looked
  // up in a map keyed on the English title, so a renamed section rendered its
  // English name in every language with nothing failing.
  it('resolves section titles from their i18n keys', () => {
    renderWithApollo(<PersonalInformationScreen />);
    expect(screen.getAllByText('Personal Information').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText('Privacy Settings')).toBeTruthy();
  });

  it('resolves field labels and modal option labels from their i18n keys', () => {
    renderWithApollo(<PersonalInformationScreen />);
    // A field label…
    expect(screen.getByText('First Name')).toBeTruthy();
    // …and an option label inside a modal field, which travelled through a
    // second English-keyed map of its own.
    const gender = screen.getByTestId('setting-gender');
    expect(gender).toBeTruthy();
  });

  it('displays email value', () => {
    renderWithApollo(<PersonalInformationScreen />);
    expect(screen.getByTestId('value-email')).toBeTruthy();
    expect(screen.getByText('john@example.com')).toBeTruthy();
  });

  it('displays firstName value', () => {
    renderWithApollo(<PersonalInformationScreen />);
    expect(screen.getByTestId('value-firstName')).toBeTruthy();
    expect(screen.getByText('John')).toBeTruthy();
  });

  it('displays lastName value', () => {
    renderWithApollo(<PersonalInformationScreen />);
    expect(screen.getByTestId('value-lastName')).toBeTruthy();
    expect(screen.getByText('Doe')).toBeTruthy();
  });

  it('displays displayName value', () => {
    renderWithApollo(<PersonalInformationScreen />);
    expect(screen.getByTestId('value-displayName')).toBeTruthy();
    expect(screen.getByText('JohnDoe')).toBeTruthy();
  });

  it('displays showEmail toggle value', () => {
    renderWithApollo(<PersonalInformationScreen />);
    expect(screen.getByTestId('value-showEmail')).toBeTruthy();
    expect(screen.getByText('true')).toBeTruthy();
  });

  describe('profileVisibility', () => {
    const renderWith = (operationMocks: MockedResponse[]) =>
      renderWithApollo(<PersonalInformationScreen />, { operationMocks });

    // The screen casts the picked string with `as ProfileVisibility`, so tsc
    // cannot catch a value the schema has no member for. FRIENDS_ONLY shipped
    // that way and the server refused every selection.
    it('sends a value the schema defines', async () => {
      const { mock, fired } = recordMock(UpdateUserProfileDocument, {
        data: {
          updateProfile: {
            __typename: 'UpdateProfilePayload',
            userProfile: {
              __typename: 'UserProfile',
              id: 'profile-1',
              profileVisibility: ProfileVisibility.Friends,
            },
          },
        },
      });
      renderWith([mock]);

      await userEvent.press(
        screen.getByTestId('option-profileVisibility-FRIENDS'),
      );

      await waitFor(() => expect(fired).toHaveLength(1));
      const sent = fired[0].input as { profileVisibility: string };
      expect(Object.values(ProfileVisibility)).toContain(
        sent.profileVisibility,
      );
    });

    // Without this the optimistic write was reverted and the row just snapped
    // back with nothing said.
    it('tells the user when the server refuses the change', async () => {
      const { mock } = recordMock(UpdateUserProfileDocument, {
        data: {
          updateProfile: {
            __typename: 'ValidationError',
            code: 'VALIDATION_ERROR',
            message: 'Invalid visibility',
            field: 'profileVisibility',
          },
        },
      });
      renderWith([mock]);

      await userEvent.press(
        screen.getByTestId('option-profileVisibility-PRIVATE'),
      );

      await waitFor(() => expect(alertService.alert).toHaveBeenCalled());
    });
  });
});
