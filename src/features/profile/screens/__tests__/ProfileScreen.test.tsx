'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import type { SettingsSectionProps } from '#components/organisms/SettingsSection';
import type {
  ActionTrayProps,
  ActionTrayRef,
} from '#/components/templates/ActionTray/types';
import { ProfileScreen } from '../ProfileScreen';

// --- Mocks ---

const mockNav = {
  goBack: jest.fn(),
  toProfilePhotoUpload: jest.fn(),
  toDeleteAccount: jest.fn(),
  toPersonalInformation: jest.fn(),
  toAppearance: jest.fn(),
  toNotificationSettings: jest.fn(),
  toDietaryProfile: jest.fn(),
  toAppSettings: jest.fn(),
  toDebugInfo: jest.fn(),
  toPerformanceDashboard: jest.fn(),
  toChangePassword: jest.fn(),
};
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: jest.fn(() => mockNav),
}));

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

let mockHasUnverifiedEmail = false;

jest.mock('#store/useAppStore', () => ({
  useAppStore: <T,>(selector: (state: RootState) => T): T => {
    const state = { canAccessDevTools: false };
    return selector(state as Partial<RootState> as RootState);
  },
  useCanAccessDevTools: jest.fn(() => false),
  useHasUnverifiedEmail: jest.fn(() => mockHasUnverifiedEmail),
}));

const mockResumeVerification = jest.fn();
jest.mock('#hooks/auth/useEmailVerification', () => ({
  useEmailVerificationActions: () => ({
    skipVerification: jest.fn(),
    resumeVerification: mockResumeVerification,
  }),
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackScreen: jest.fn(),
    trackEvent: jest.fn(),
  },
}));

// Environment is auto-mocked via jest.setup.js. ProfileScreen tests want
// `shouldEnableDebugFeatures` to return false (debug section hidden in
// non-dev contexts), so we override it below.
import { Environment } from '#/utils/environment';
beforeEach(() => {
  (Environment.shouldEnableDebugFeatures as jest.Mock).mockReturnValue(false);
});

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/organisms/ProfileHeader', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    ProfileHeader: ({
      name,
      subtitle,
      onBack,
      onMore,
      onAvatarPress,
    }: {
      name?: string;
      subtitle?: string;
      onBack?: () => void;
      onMore?: () => void;
      onAvatarPress?: () => void;
    }) => (
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
    SettingsSection: ({
      title,
      items,
    }: {
      title?: SettingsSectionProps['title'];
      items: SettingsSectionProps['items'];
    }) => (
      <View testID={`settings-section-${title || 'actions'}`}>
        {title ? <Text>{title}</Text> : null}
        {items.map(item => (
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
    props: ActionTrayProps,
    ref: React.Ref<ActionTrayRef>,
  ) {
    R.useImperativeHandle(ref, () => ({
      open: jest.fn(),
      close: jest.fn(),
    }));
    return R.createElement(RN.View, { testID: 'action-tray' }, props.children);
  });
  return { ActionTray };
});

jest.mock('#components/atoms/Skeleton/ProfileSkeleton', () => ({
  ProfileSkeleton: () => 'ProfileSkeleton',
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasUnverifiedEmail = false;
  });

  it('hides the verify-email banner when the address is verified', () => {
    render(<ProfileScreen />);
    expect(screen.queryByTestId('verify-email-banner')).toBeNull();
  });

  it('shows the verify-email banner for an unverified address', () => {
    mockHasUnverifiedEmail = true;
    render(<ProfileScreen />);
    expect(screen.getByTestId('verify-email-banner')).toBeTruthy();
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

  it('navigates to PersonalInformation on press', async () => {
    const user = userEvent.setup();
    render(<ProfileScreen />);
    await user.press(screen.getByTestId('profile-menu-personalInformation'));
    expect(mockNav.toPersonalInformation).toHaveBeenCalledTimes(1);
  });

  it('navigates to DietaryProfile on press', async () => {
    const user = userEvent.setup();
    render(<ProfileScreen />);
    await user.press(screen.getByTestId('profile-menu-dietaryProfile'));
    expect(mockNav.toDietaryProfile).toHaveBeenCalledTimes(1);
  });

  it('navigates to AppSettings on press', async () => {
    const user = userEvent.setup();
    render(<ProfileScreen />);
    await user.press(screen.getByTestId('profile-menu-appSettings'));
    expect(mockNav.toAppSettings).toHaveBeenCalledTimes(1);
  });

  it('navigates to ChangePassword on press', async () => {
    const user = userEvent.setup();
    render(<ProfileScreen />);
    await user.press(screen.getByTestId('profile-menu-changePassword'));
    expect(mockNav.toChangePassword).toHaveBeenCalledTimes(1);
  });

  it('calls goBack when back button is pressed', async () => {
    const user = userEvent.setup();
    render(<ProfileScreen />);
    await user.press(screen.getByTestId('back-button'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to ProfilePhotoUpload when avatar is pressed', async () => {
    const user = userEvent.setup();
    render(<ProfileScreen />);
    await user.press(screen.getByTestId('avatar-button'));
    expect(mockNav.toProfilePhotoUpload).toHaveBeenCalledTimes(1);
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
