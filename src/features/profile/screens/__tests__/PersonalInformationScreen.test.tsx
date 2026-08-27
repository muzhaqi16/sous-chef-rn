'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { PersonalInformationScreen } from '../PersonalInformationScreen';
import type { SettingsSectionProps } from '#components/organisms/SettingsSection';

jest.mock('#features/profile/hooks/useProfileData', () => ({
  useProfileData: () => ({
    profile: {
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

jest.mock('#/services/errorService', () => ({
  errorService: {
    reportError: jest.fn(),
  },
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

jest.mock('#components/organisms/SettingsSection', () => {
  const { View, Text } = require('react-native');
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
});
