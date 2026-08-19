'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { PickerProps, PickerItemProps } from '@react-native-picker/picker';
import { AppSettingsScreen } from '../AppSettingsScreen';

// --- Mocks ---

const mockUpdateAppSetting = jest.fn().mockResolvedValue(true);
const mockResetToDefaults = jest.fn().mockResolvedValue(true);

jest.mock('#features/profile/hooks/useAppSettings', () => ({
  useAppSettings: () => ({
    settings: {
      preferredUnitSystem: 'METRIC',
      autoSync: true,
      offlineMode: false,
      showTutorials: true,
      betaFeatures: [],
    },
    loading: false,
    updateAppSetting: mockUpdateAppSetting,
    resetToDefaults: mockResetToDefaults,
  }),
}));

jest.mock('#store/useAppStore', () => {
  const getState = () => ({
    hapticFeedbackEnabled: true,
    setHapticFeedbackEnabled: jest.fn(),
    showNavigationLabels: true,
    setShowNavigationLabels: jest.fn(),
    userConsent: true,
    setUserConsent: jest.fn(),
  });
  type MockState = ReturnType<typeof getState>;
  return {
    useAppStore: (selector: (state: MockState) => unknown) =>
      selector(getState()),
    useShowNavigationLabels: () => getState().showNavigationLabels,
  };
});

jest.mock('#hooks/settings/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: { showShoppingListImages: true },
    updatePreference: jest.fn(),
    resetPreferences: jest.fn(),
  }),
}));

jest.mock('#hooks/useFeatureHint', () => ({
  resetAllFeatureHints: jest.fn(),
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    loadingContainer: {},
    loadingText: {},
    subtitle: {},
    chip: {},
    chipText: {},
  },
}));

jest.mock('#components/templates/ProfileScreenWrapper', () => {
  const { View, Text } = require('react-native');
  return {
    ProfileScreenWrapper: ({
      children,
      title,
      testID,
    }: {
      children?: React.ReactNode;
      title?: string;
      testID?: string;
    }) => (
      <View testID={testID}>
        <Text>{title}</Text>
        {children}
      </View>
    ),
  };
});

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#components/settings/SettingSwitch', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    SettingSwitch: ({
      title,
      description,
      value,
      onValueChange,
      testID,
    }: {
      title: string;
      description?: string;
      value: boolean;
      onValueChange: (value: boolean) => void;
      testID?: string;
    }) => (
      <View testID={testID || `switch-${title}`}>
        <Text>{title}</Text>
        {description ? <Text>{description}</Text> : null}
        <Pressable
          testID={`toggle-${title}`}
          onPress={() => onValueChange(!value)}
        >
          <Text>{value ? 'ON' : 'OFF'}</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock('#components/settings/SettingSection', () => {
  const { View, Text } = require('react-native');
  return {
    SettingSection: ({
      title,
      children,
    }: {
      title: string;
      children?: React.ReactNode;
    }) => (
      <View testID={`section-${title}`}>
        <Text>{title}</Text>
        {children}
      </View>
    ),
  };
});

jest.mock('@react-native-picker/picker', () => {
  const { View, Text } = require('react-native');
  const Picker = ({ children, testID, selectedValue }: PickerProps) => (
    <View testID={testID}>
      <Text>{selectedValue}</Text>
      {children}
    </View>
  );
  Picker.Item = ({ label }: PickerItemProps) => {
    const { Text: RNText } = require('react-native');
    return <RNText>{label}</RNText>;
  };
  return { Picker };
});

describe('AppSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the settings screen', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByTestId('settings-screen')).toBeTruthy();
  });

  it('renders the screen title', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('App Settings')).toBeTruthy();
  });

  it('renders Units & Measurements section', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Units & Measurements')).toBeTruthy();
  });

  it('renders Sync & Offline section', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Sync & Offline')).toBeTruthy();
  });

  it('renders Features section', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Features')).toBeTruthy();
  });

  it('renders Experience section with haptic feedback toggle', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Experience')).toBeTruthy();
    expect(screen.getByText('Haptic Feedback')).toBeTruthy();
  });

  it('renders Auto Sync toggle', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Auto Sync')).toBeTruthy();
  });

  it('renders Navigation Labels toggle', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Navigation Labels')).toBeTruthy();
  });

  it('renders Share Usage Data toggle', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Share Usage Data')).toBeTruthy();
  });

  it('renders Reset section', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Reset')).toBeTruthy();
    expect(screen.getByText('Reset to Defaults')).toBeTruthy();
  });

  it('renders the unit system picker', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByTestId('settings-unit-system-picker')).toBeTruthy();
  });
});

describe('AppSettingsScreen - loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(
        require('#features/profile/hooks/useAppSettings'),
        'useAppSettings',
      )
      .mockReturnValue({
        settings: {
          preferredUnitSystem: 'METRIC',
          autoSync: true,
          offlineMode: false,
          showTutorials: true,
          betaFeatures: [],
        },
        loading: true,
        updateAppSetting: mockUpdateAppSetting,
        resetToDefaults: mockResetToDefaults,
      });
  });

  it('shows loading text when settings are loading', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Loading settings...')).toBeTruthy();
  });
});
