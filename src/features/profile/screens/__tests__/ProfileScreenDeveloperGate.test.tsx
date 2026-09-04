'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import type { SettingsSectionProps } from '#components/organisms/SettingsSection';
import type {
  ActionTrayProps,
  ActionTrayRef,
} from '#components/templates/ActionTray/types';
import { Environment } from '#/utils/environment';
import { ProfileScreen } from '../ProfileScreen';

/**
 * The Developer section gate.
 *
 * `useConfigurableSettings` keys each section by `SettingSectionConfig.id` — a
 * stable, untranslated identity. This suite supplies the section the real hook
 * produces, which is what `ProfileScreen.test.tsx` omits: its mocked sections
 * carry no developer entry at all, so the filter there is never reached and its
 * green result says nothing about whether the gate holds.
 */

let mockCanAccessDevTools = false;

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

// Mirrors what the real hook emits: `key` is the config section's stable id.
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
        key: 'developer',
        title: 'Developer',
        items: [
          { key: 'debugInfo', label: 'Debug Info', type: 'navigation' },
          {
            key: 'performanceDashboard',
            label: 'Performance Dashboard',
            type: 'navigation',
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
  useCanAccessDevTools: jest.fn(() => mockCanAccessDevTools),
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
        {items?.map(item => (
          <Pressable key={item.key} testID={`setting-${item.key}`}>
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

describe('ProfileScreen developer section gate', () => {
  beforeEach(() => {
    mockCanAccessDevTools = false;
    (Environment.shouldEnableDebugFeatures as jest.Mock).mockReturnValue(false);
  });

  it('hides the developer section when debug features are off and the account has no dev access', () => {
    render(<ProfileScreen />);

    expect(screen.queryByTestId('settings-section-Developer')).toBeNull();
    expect(screen.queryByTestId('setting-debugInfo')).toBeNull();
    expect(screen.queryByTestId('setting-performanceDashboard')).toBeNull();
  });

  it('shows the developer section when the build enables debug features', () => {
    (Environment.shouldEnableDebugFeatures as jest.Mock).mockReturnValue(true);

    render(<ProfileScreen />);

    expect(screen.getByTestId('settings-section-Developer')).toBeTruthy();
    expect(screen.getByTestId('setting-debugInfo')).toBeTruthy();
  });

  it('shows the developer section when the account has dev-tool access', () => {
    mockCanAccessDevTools = true;

    render(<ProfileScreen />);

    expect(screen.getByTestId('settings-section-Developer')).toBeTruthy();
  });

  it('renders non-developer sections regardless of dev access', () => {
    render(<ProfileScreen />);

    expect(screen.getByTestId('settings-section-Account')).toBeTruthy();
  });
});
