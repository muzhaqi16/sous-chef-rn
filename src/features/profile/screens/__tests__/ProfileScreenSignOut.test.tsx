'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import type { SettingsSectionProps } from '#components/organisms/SettingsSection';
import type {
  ActionTrayProps,
  ActionTrayRef,
} from '#components/templates/ActionTray/types';
import { Telemetry } from '#/services/telemetry';
import { ProfileScreen } from '../ProfileScreen';

/**
 * Sign-out lives in the more-options tray: pressing it runs the settings hook's
 * `logout`, which owns the pending-writes warning and `authService.logout`.
 */

const mockSignOut = jest.fn();

jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: jest.fn(() => ({
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
  })),
}));

jest.mock('#features/profile/hooks/useProfileData', () => ({
  useProfileData: () => ({
    profile: { firstName: 'John', lastName: 'Doe', displayName: 'JohnDoe' },
    user: { email: 'john@example.com' },
    loading: false,
  }),
}));

jest.mock('#features/profile/hooks/useConfigurableSettings', () => ({
  useConfigurableSettings: () => ({
    sections: [
      {
        key: 'account',
        title: 'Account',
        items: [
          {
            key: 'personalInformation',
            label: 'Personal Information',
            type: 'navigation',
          },
        ],
      },
    ],
    BiometricModal: null,
    logout: mockSignOut,
  }),
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: <T,>(selector: (state: RootState) => T): T =>
    selector({ canAccessDevTools: false } as Partial<RootState> as RootState),
  useCanAccessDevTools: jest.fn(() => false),
  useHasUnverifiedEmail: jest.fn(() => false),
}));

jest.mock('#hooks/auth/useEmailVerification', () => ({
  useEmailVerificationActions: () => ({
    skipVerification: jest.fn(),
    resumeVerification: jest.fn(),
  }),
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#/utils/iconUtils', () => ({ Icon: 'Icon' }));

jest.mock('#features/profile/components/ProfileHero', () => {
  const { View } = require('react-native');
  return { ProfileHero: () => <View testID="profile-hero" /> };
});

// Presses through to the item's own onPress, which is the whole point: a
// renderer that swallows the handler is exactly the defect under test.
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
        {items?.map(item => (
          <Pressable
            key={item.key}
            testID={item.testID ?? `setting-${item.key}`}
            onPress={item.onPress}
          >
            <Text>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

jest.mock('#components/templates/ActionTray/ActionTray', () => {
  const R = require('react');
  const RN = require('react-native');
  const ActionTray = R.forwardRef(function MockActionTray(
    props: ActionTrayProps,
    ref: React.Ref<ActionTrayRef>,
  ) {
    R.useImperativeHandle(ref, () => ({ open: jest.fn(), close: jest.fn() }));
    return <RN.View testID="action-tray">{props.children}</RN.View>;
  });
  return { ActionTray };
});

describe('ProfileScreen sign-out', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs out from the more-options tray', () => {
    render(<ProfileScreen />);

    fireEvent.press(screen.getByTestId('profile-logout-button'));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(Telemetry.trackEvent).toHaveBeenCalledWith('logout_clicked', {
      source: 'ProfileScreen',
    });
  });

  it('reaches the row by its label', () => {
    render(<ProfileScreen />);

    fireEvent.press(screen.getByText('Log Out'));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('is no longer a settings row', () => {
    render(<ProfileScreen />);

    expect(screen.getAllByText('Log Out')).toHaveLength(1);
    expect(screen.getByTestId('action-tray')).toContainElement(
      screen.getByTestId('profile-logout-button'),
    );
  });
});
