'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AppSettingsScreen } from '../AppSettingsScreen';

// --- Mocks ---

const mockUpdateAppSetting = jest.fn().mockResolvedValue(true);
const mockResetToDefaults = jest.fn().mockResolvedValue(true);

jest.mock('#hooks/profile/useAppSettings', () => ({
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

jest.mock('#/store/useAppStore', () => ({
  useAppStore: (selector: any) => {
    const state = {
      hapticFeedbackEnabled: true,
      setHapticFeedbackEnabled: jest.fn(),
      showNavigationLabels: true,
      setShowNavigationLabels: jest.fn(),
      userConsent: true,
      setUserConsent: jest.fn(),
    };
    return selector(state);
  },
}));

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

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#generated', () => ({
  UnitSystem: { Metric: 'METRIC', Imperial: 'IMPERIAL', System: 'SYSTEM' },
}));

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
    ProfileScreenWrapper: ({ children, title, testID }: any) => (
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
    SettingSwitch: ({ title, description, value, onValueChange, testID }: any) => (
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
    SettingSection: ({ title, children }: any) => (
      <View testID={`section-${title}`}>
        <Text>{title}</Text>
        {children}
      </View>
    ),
  };
});

jest.mock('@react-native-picker/picker', () => {
  const { View, Text } = require('react-native');
  const Picker = ({ children, testID, selectedValue }: any) => (
    <View testID={testID}>
      <Text>{selectedValue}</Text>
      {children}
    </View>
  );
  Picker.Item = ({ label }: any) => {
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
      .spyOn(require('#hooks/profile/useAppSettings'), 'useAppSettings')
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
