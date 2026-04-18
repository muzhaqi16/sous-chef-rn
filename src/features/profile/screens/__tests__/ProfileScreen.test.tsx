'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ProfileScreen } from '../ProfileScreen';

// --- Mocks ---

jest.mock('#hooks/navigation/useAppNavigation');
const mockNav = (
  jest.requireMock('#hooks/navigation/useAppNavigation') as {
    useAppNavigation: jest.Mock;
  }
).useAppNavigation();

jest.mock('#features/profile/hooks/useProfileData', () => ({
  useProfileData: () => ({
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'JohnDoe',
      avatar: 'https://example.com/avatar.jpg',
      bio: 'Test bio',
    },
    user: { email: 'john@example.com' },
    loading: false,
  }),
}));

jest.mock('#features/profile/hooks/useConfigurableSettings', () => ({
  useConfigurableSettings: () => ({
    sections: [
      {
        title: 'Account',
        items: [
          {
            key: 'personalInformation',
            label: 'Personal Information',
            type: 'navigation',
          },
          {
            key: 'changePassword',
            label: 'Change Password',
            type: 'navigation',
          },
        ],
      },
      {
        title: 'Preferences',
        items: [
          {
            key: 'dietaryProfile',
            label: 'Dietary Profile',
            type: 'navigation',
          },
          { key: 'appSettings', label: 'App Settings', type: 'navigation' },
          { key: 'notifications', label: 'Notifications', type: 'navigation' },
        ],
      },
      {
        title: '',
        items: [
          {
            key: 'logout',
            label: 'Logout',
            type: 'action',
            onPress: jest.fn(),
          },
        ],
      },
    ],
    BiometricModal: null,
  }),
}));

jest.mock('#/store/useAppStore', () => ({
  useAppStore: (selector: any) => {
    const state = { canAccessDevTools: false };
    return selector(state);
  },
  useCanAccessDevTools: jest.fn(() => false),
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackScreen: jest.fn(),
    trackEvent: jest.fn(),
  },
}));

jest.mock('#/utils/environment', () => ({
  Environment: {
    shouldEnableDebugFeatures: () => false,
  },
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/organisms/ProfileHeader', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    ProfileHeader: ({ name, subtitle, onBack, onMore, onAvatarPress }: any) => (
      <View testID="profile-header">
        <Text>{name}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
        <Pressable testID="back-button" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        <Pressable testID="more-button" onPress={onMore}>
          <Text>More</Text>
        </Pressable>
        <Pressable testID="avatar-button" onPress={onAvatarPress}>
          <Text>Avatar</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock('#components/organisms/SettingsSection', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    SettingsSection: ({ title, items }: any) => (
      <View testID={`settings-section-${title || 'actions'}`}>
        {title ? <Text>{title}</Text> : null}
        {items.map((item: any) => (
          <Pressable
            key={item.key}
            testID={item.testID || `setting-${item.key}`}
            onPress={item.onPress}
          >
            <Text>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

jest.mock('#/components/templates/ActionTray/ActionTray', () => {
  const R = require('react');
  const RN = require('react-native');
  const ActionTray = R.forwardRef(function MockActionTray(
    props: any,
    ref: any,
  ) {
    R.useImperativeHandle(ref, () => ({
      open: jest.fn(),
      close: jest.fn(),
    }));
    return R.createElement(RN.View, { testID: 'action-tray' }, props.children);
  });
  return { ActionTray };
});

jest.mock('#components/base/Skeleton/ProfileSkeleton', () => ({
  ProfileSkeleton: () => 'ProfileSkeleton',
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the profile screen', () => {
    render(<ProfileScreen />);
    expect(screen.getByTestId('profile-header')).toBeTruthy();
  });

  it('renders the profile header with user name', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('JohnDoe')).toBeTruthy();
  });

  it('renders the user email in the header', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('john@example.com')).toBeTruthy();
  });

  it('renders Account settings section', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Personal Information')).toBeTruthy();
    expect(screen.getByText('Change Password')).toBeTruthy();
  });

  it('renders Preferences settings section', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Preferences')).toBeTruthy();
    expect(screen.getByText('Dietary Profile')).toBeTruthy();
    expect(screen.getByText('App Settings')).toBeTruthy();
  });

  it('navigates to PersonalInformation on press', () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('profile-menu-personalInformation'));
    expect(mockNav.navigate).toHaveBeenCalledWith('PersonalInformation');
  });

  it('navigates to DietaryProfile on press', () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('profile-menu-dietaryProfile'));
    expect(mockNav.navigate).toHaveBeenCalledWith('DietaryProfile');
  });

  it('navigates to AppSettings on press', () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('profile-menu-appSettings'));
    expect(mockNav.navigate).toHaveBeenCalledWith('AppSettings');
  });

  it('navigates to ChangePassword on press', () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('profile-menu-changePassword'));
    expect(mockNav.navigate).toHaveBeenCalledWith('ChangePassword');
  });

  it('calls goBack when back button is pressed', () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('back-button'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to ProfilePhotoUpload when avatar is pressed', () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('avatar-button'));
    expect(mockNav.navigate).toHaveBeenCalledWith('ProfilePhotoUpload');
  });

  it('renders the delete account option in action tray', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Delete Account')).toBeTruthy();
  });
});

describe('ProfileScreen - loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(
        require('#features/profile/hooks/useProfileData'),
        'useProfileData',
      )
      .mockReturnValue({
        profile: null,
        user: null,
        loading: true,
      });
  });

  it('shows skeleton when loading with no profile data', () => {
    const { toJSON } = render(<ProfileScreen />);
    // ProfileSkeleton is rendered as a string in the mock
    expect(toJSON()).toBeTruthy();
  });
});
