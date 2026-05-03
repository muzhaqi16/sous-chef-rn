'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PersonalInformationScreen } from '../PersonalInformationScreen';

// --- Mocks ---

const mockUpdateProfileMutation = jest.fn().mockResolvedValue({});

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

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useApolloClient: () => ({
    readQuery: jest.fn(() => null),
    writeQuery: jest.fn(),
    refetchQueries: jest.fn(),
  }),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'UpdateUserProfile')
      return [mockUpdateProfileMutation, { loading: false }];
    return [jest.fn(), {}];
  }),
}));

jest.mock('#/services/errorService', () => ({
  errorService: {
    reportError: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#utils/dateUtils', () => ({
  dateStringToISO: jest.fn((val: string) => val),
  extractDateString: jest.fn((val: string) => val || ''),
}));

jest.mock('#/config/settingsConfig', () => ({
  PERSONAL_INFO_CONFIG: [
    {
      title: 'Basic Info',
      items: [
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'firstName', label: 'First Name', type: 'editable' },
        { key: 'lastName', label: 'Last Name', type: 'editable' },
        { key: 'displayName', label: 'Display Name', type: 'editable' },
      ],
    },
    {
      title: 'Privacy',
      items: [
        { key: 'showEmail', label: 'Show Email', type: 'toggle' },
        { key: 'showPhone', label: 'Show Phone', type: 'toggle' },
      ],
    },
  ],
}));

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#components/templates/ProfileScreenWrapper', () => {
  const { View, Text } = require('react-native');
  return {
    ProfileScreenWrapper: ({ children, title }: any) => (
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
    SettingsSection: ({ title, items }: any) => (
      <View testID={`section-${title}`}>
        <Text>{title}</Text>
        {items.map((item: any) => (
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
    render(<PersonalInformationScreen />);
    expect(screen.getByText('Personal Information')).toBeTruthy();
  });

  it('renders Basic Info section', () => {
    render(<PersonalInformationScreen />);
    expect(screen.getByText('Basic Info')).toBeTruthy();
  });

  it('renders Privacy section', () => {
    render(<PersonalInformationScreen />);
    expect(screen.getByText('Privacy')).toBeTruthy();
  });

  it('displays email value', () => {
    render(<PersonalInformationScreen />);
    expect(screen.getByTestId('value-email')).toBeTruthy();
    expect(screen.getByText('john@example.com')).toBeTruthy();
  });

  it('displays firstName value', () => {
    render(<PersonalInformationScreen />);
    expect(screen.getByTestId('value-firstName')).toBeTruthy();
    expect(screen.getByText('John')).toBeTruthy();
  });

  it('displays lastName value', () => {
    render(<PersonalInformationScreen />);
    expect(screen.getByTestId('value-lastName')).toBeTruthy();
    expect(screen.getByText('Doe')).toBeTruthy();
  });

  it('displays displayName value', () => {
    render(<PersonalInformationScreen />);
    expect(screen.getByTestId('value-displayName')).toBeTruthy();
    expect(screen.getByText('JohnDoe')).toBeTruthy();
  });

  it('displays showEmail toggle value', () => {
    render(<PersonalInformationScreen />);
    expect(screen.getByTestId('value-showEmail')).toBeTruthy();
    expect(screen.getByText('true')).toBeTruthy();
  });
});
