'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
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

jest.mock('#components/organisms/SettingsSection', () => {
  const { View, Text } = require('react-native');
  return {
    SettingsSection: ({
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

// Stands in for the tray so the OPTIONS are reachable without driving gorhom's
// present/animate cycle. The seam is the screen's contract with ModalPicker —
// `visible` in, `onSelect` out — which is the part this screen owns.
jest.mock('#components/molecules/ModalPicker', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    ModalPicker: ({
      visible,
      options,
      selected,
      onSelect,
    }: {
      visible: boolean;
      options: { label: string; value: string }[];
      selected: string;
      onSelect: (value: string) => void;
    }) =>
      visible ? (
        <View testID="modal-picker">
          <Text testID="modal-picker-selected">{selected}</Text>
          {options.map(opt => (
            <Pressable
              key={opt.value}
              testID={`modal-picker-option-${opt.value}`}
              onPress={() => onSelect(opt.value)}
            >
              <Text>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null,
  };
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

  it('renders the unit system picker closed, and opens it on press', () => {
    render(<AppSettingsScreen />);
    expect(screen.queryByTestId('modal-picker')).toBeNull();

    fireEvent.press(screen.getByTestId('settings-unit-system-picker'));

    expect(screen.getByTestId('modal-picker')).toBeTruthy();
    // The tray opens on the current value, not on a default.
    expect(screen.getByTestId('modal-picker-selected')).toHaveTextContent(
      'METRIC',
    );
  });

  it('writes the selected unit system through and closes the picker', () => {
    render(<AppSettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-unit-system-picker'));

    fireEvent.press(screen.getByTestId('modal-picker-option-IMPERIAL'));

    expect(mockUpdateAppSetting).toHaveBeenCalledWith(
      'preferredUnitSystem',
      'IMPERIAL',
    );
    expect(screen.queryByTestId('modal-picker')).toBeNull();
  });
});

/**
 * The gate is `loading && !hasLoadedSettings`, not `loading`. Under
 * `cache-and-network` Apollo reports `loading: true` for the whole network leg
 * on EVERY mount — `nextFetchPolicy` lives on the ObservableQuery and useQuery
 * builds a new one each time — so gating on `loading` alone blanked this screen
 * on every visit for as long as the request took, which against a stalled API
 * is the 10s httpLink abort deadline.
 */
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
        hasLoadedSettings: false,
        updateAppSetting: mockUpdateAppSetting,
        resetToDefaults: mockResetToDefaults,
      });
  });

  it('shows loading text when nothing has been loaded yet', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Loading settings...')).toBeTruthy();
  });

  it('keeps the header and back button while it waits', () => {
    render(<AppSettingsScreen />);
    // The loading branch used to return a bare View, so a stalled request left
    // the user on a blank screen with no way off it.
    expect(screen.getByTestId('settings-screen')).toBeTruthy();
    expect(screen.getByText('App Settings')).toBeTruthy();
  });

  it('renders the settings while a background refresh is in flight', () => {
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
        hasLoadedSettings: true,
        updateAppSetting: mockUpdateAppSetting,
        resetToDefaults: mockResetToDefaults,
      });

    render(<AppSettingsScreen />);

    expect(screen.queryByText('Loading settings...')).toBeNull();
    expect(screen.getByTestId('settings-screen')).toBeTruthy();
    expect(screen.getByText('Auto Sync')).toBeTruthy();
  });
});
