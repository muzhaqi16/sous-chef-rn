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
 * Sign-out reachability.
 *
 * Finding the logout ROW by looking its SECTION up by `key` gives one action
 * two independent identifier bindings. Rename what `useConfigurableSettings`
 * puts in `key` — `configSection.title` versus `configSection.id` — and the
 * lookup stops matching, leaving Log Out a button that fires telemetry and
 * nothing else, with every suite still green because nothing pressed it.
 *
 * So this suite presses the row and asserts the handler the settings config
 * built actually runs, and it does so with the section carrying an unexpected
 * id: the binding must be to the item the renderer already holds, never to a
 * section identifier a refactor is free to rename.
 */

const mockSignOut = jest.fn();
let mockLogoutSectionKey = 'logout';

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

// Mirrors the real hook's output: a section keyed by its stable config id,
// holding a logout item that carries the sign-out handler itself.
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
      {
        key: mockLogoutSectionKey,
        title: '',
        items: [
          {
            key: 'logout',
            label: 'Log Out',
            type: 'action',
            onPress: mockSignOut,
          },
        ],
      },
    ],
    BiometricModal: null,
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

jest.mock('#/services/telemetry', () => ({
  Telemetry: { trackScreen: jest.fn(), trackEvent: jest.fn() },
}));

jest.mock('#/utils/iconUtils', () => ({ Icon: 'Icon' }));

jest.mock('#features/profile/components/ProfileHeader', () => {
  const { View } = require('react-native');
  return { ProfileHeader: () => <View testID="profile-header" /> };
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
    return <RN.View testID="action-tray" />;
  });
  return { ActionTray };
});

describe('ProfileScreen sign-out', () => {
  beforeEach(() => {
    mockLogoutSectionKey = 'logout';
    jest.clearAllMocks();
  });

  it('runs the sign-out handler the settings config built', () => {
    render(<ProfileScreen />);

    fireEvent.press(screen.getByTestId('profile-logout-button'));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('records the tap without swallowing the handler', () => {
    render(<ProfileScreen />);

    fireEvent.press(screen.getByTestId('profile-logout-button'));

    expect(Telemetry.trackEvent).toHaveBeenCalledWith('logout_clicked', {
      source: 'ProfileScreen',
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('still signs out when the logout section is renamed', () => {
    // The regression this suite exists for: a section-identifier rename must
    // not be able to disconnect the button.
    mockLogoutSectionKey = 'session-actions';

    render(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('profile-logout-button'));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('reaches the row by its label', () => {
    render(<ProfileScreen />);

    fireEvent.press(screen.getByText('Log Out'));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
