'use no memo';
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  within,
} from '@testing-library/react-native';
import { AppSettingsScreen } from '../AppSettingsScreen';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { hasFeatureHintBeenShown } from '#hooks/settings/useFeatureHint';
import { featureHintKey } from '#store/slices/tutorialSlice';
import { useStore } from '#store';
import { profileTestIDs } from '#features/profile/testIDs';

// --- Mocks ---

const mockUpdateAppSetting = jest.fn().mockResolvedValue(true);
const mockResetToDefaults = jest.fn().mockResolvedValue(true);

// A function, not a const: a const initialised to `undefined` narrows to it, and
// a case below returns an Error in its place.
const noError = (): Error | undefined => undefined;

const mockAppSettings = jest.fn(() => ({
  settings: {
    preferredUnitSystem: 'METRIC',
    showTutorials: true,
    storeMode: false,
    budgetAndPrices: null,
  },
  loading: false,
  hasLoadedSettings: true,
  error: noError(),
  refetch: jest.fn(),
  updateAppSetting: mockUpdateAppSetting,
  resetToDefaults: mockResetToDefaults,
}));
jest.mock('#features/profile/hooks/useAppSettings', () => ({
  useAppSettings: () => mockAppSettings(),
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
    useUserId: () => 'account-a',
  };
});

const mockUpdatePreference = jest.fn();
jest.mock('#hooks/settings/useUserPreferences', () => ({
  useUserPreferences: () => ({
    preferences: { showShoppingListImages: true },
    updatePreference: mockUpdatePreference,
    resetPreferences: jest.fn(),
  }),
}));

jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
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

jest.mock('#components/templates/SubScreen', () => {
  const { View, Text } = require('react-native');
  return {
    SubScreen: ({
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

jest.mock('#components/molecules/SettingSwitch', () => {
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

  it('shows only the data state when the settings query has nothing', () => {
    mockAppSettings.mockReturnValueOnce({
      settings: {
        preferredUnitSystem: 'METRIC',
        showTutorials: true,
        storeMode: false,
        budgetAndPrices: null,
      },
      loading: false,
      hasLoadedSettings: false,
      error: new Error('offline'),
      refetch: jest.fn(),
      updateAppSetting: mockUpdateAppSetting,
      resetToDefaults: mockResetToDefaults,
    });

    render(<AppSettingsScreen />);

    expect(screen.getByTestId(profileTestIDs.settingsState)).toBeTruthy();
    expect(
      screen.queryByTestId(profileTestIDs.settingsShowTutorialsSwitch),
    ).toBeNull();
  });

  it('offers no offline or sync setting', () => {
    render(<AppSettingsScreen />);

    expect(screen.queryByText('Sync & Offline')).toBeNull();
    expect(screen.queryByText('Offline Mode')).toBeNull();
    expect(screen.queryByText('Auto Sync')).toBeNull();
  });

  it('renders the settings screen', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByTestId('settings-screen')).toBeTruthy();
  });

  // Kept with the account, so every device shows the same switch.
  it('turns store mode on for the account', () => {
    render(<AppSettingsScreen />);

    expect(
      screen.getByTestId(profileTestIDs.settingsStoreModeSwitch),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('toggle-Store mode'));

    expect(mockUpdateAppSetting).toHaveBeenCalledWith('storeMode', true);
  });

  it('offers no store mode switch where the build leaves it out', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);
    render(<AppSettingsScreen />);

    expect(
      screen.queryByTestId(profileTestIDs.settingsStoreModeSwitch),
    ).toBeNull();
    jest.mocked(useFeatureFlag).mockReturnValue(true);
  });

  // Off until answered; turning it on by hand shows prices at once.
  it('turns budget and prices on for the account', () => {
    render(<AppSettingsScreen />);

    expect(
      screen.getByTestId(profileTestIDs.settingsBudgetAndPricesSwitch),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('toggle-Budget & prices'));

    expect(mockUpdateAppSetting).toHaveBeenCalledWith('budgetAndPrices', true);
  });

  it('offers no budget and prices switch where the build leaves it out', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);
    render(<AppSettingsScreen />);

    expect(
      screen.queryByTestId(profileTestIDs.settingsBudgetAndPricesSwitch),
    ).toBeNull();
    jest.mocked(useFeatureFlag).mockReturnValue(true);
  });

  it('renders the screen title', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('App Settings')).toBeTruthy();
  });

  it('renders Units & Measurements section', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Units & Measurements')).toBeTruthy();
  });

  it('renders Features section', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Features')).toBeTruthy();
  });

  it('keeps store mode and budget and prices together under Shopping', () => {
    render(<AppSettingsScreen />);

    const shopping = within(screen.getByTestId('section-Shopping'));
    expect(
      shopping.getByTestId(profileTestIDs.settingsStoreModeSwitch),
    ).toBeTruthy();
    expect(
      shopping.getByTestId(profileTestIDs.settingsBudgetAndPricesSwitch),
    ).toBeTruthy();

    const experience = within(screen.getByTestId('section-Experience'));
    expect(
      experience.getByTestId(profileTestIDs.settingsHapticFeedbackSwitch),
    ).toBeTruthy();
    expect(
      experience.queryByTestId(profileTestIDs.settingsStoreModeSwitch),
    ).toBeNull();
    expect(
      experience.queryByTestId(profileTestIDs.settingsBudgetAndPricesSwitch),
    ).toBeNull();
  });

  it('shows no Shopping section where the build offers neither switch', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);
    render(<AppSettingsScreen />);

    expect(screen.queryByTestId('section-Shopping')).toBeNull();
    jest.mocked(useFeatureFlag).mockReturnValue(true);
  });

  it('renders Experience section with haptic feedback toggle', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByText('Experience')).toBeTruthy();
    expect(screen.getByText('Haptic Feedback')).toBeTruthy();
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
describe('AppSettingsScreen - Replay tips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStore.setState({
      featureHintsShown: {
        [featureHintKey('account-a', 'first_shop')]: true,
        [featureHintKey('account-b', 'first_shop')]: true,
      },
      lastUnpromptedTipAt: { 'account-a': 1, 'account-b': 1 },
    });
  });

  it('Two accounts on one phone: brings back only this account’s tips', () => {
    render(<AppSettingsScreen />);

    fireEvent.press(screen.getByTestId(profileTestIDs.settingsReplayTips));

    expect(hasFeatureHintBeenShown('first_shop', 'account-a')).toBe(false);
    expect(hasFeatureHintBeenShown('first_shop', 'account-b')).toBe(true);
    expect(useStore.getState().lastUnpromptedTipAt).toEqual({
      'account-b': 1,
    });
  });

  it('turns tips back on for the account when they are off', () => {
    mockAppSettings.mockReturnValueOnce({
      settings: {
        preferredUnitSystem: 'METRIC',
        showTutorials: false,
        storeMode: false,
        budgetAndPrices: null,
      },
      loading: false,
      hasLoadedSettings: true,
      error: noError(),
      refetch: jest.fn(),
      updateAppSetting: mockUpdateAppSetting,
      resetToDefaults: mockResetToDefaults,
    });
    render(<AppSettingsScreen />);

    fireEvent.press(screen.getByTestId(profileTestIDs.settingsReplayTips));

    expect(mockUpdateAppSetting).toHaveBeenCalledWith('showTutorials', true);
  });

  it('leaves the switch alone when tips are already on', () => {
    render(<AppSettingsScreen />);

    fireEvent.press(screen.getByTestId(profileTestIDs.settingsReplayTips));

    expect(mockUpdateAppSetting).not.toHaveBeenCalled();
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
          showTutorials: true,
          storeMode: false,
          budgetAndPrices: null,
        },
        loading: true,
        hasLoadedSettings: false,
        error: undefined,
        refetch: jest.fn(),
        updateAppSetting: mockUpdateAppSetting,
        resetToDefaults: mockResetToDefaults,
      });
  });

  it('shows loading text when nothing has been loaded yet', () => {
    render(<AppSettingsScreen />);
    expect(screen.getByTestId('settings-state')).toBeTruthy();
  });

  it('keeps the header and back button while it waits', () => {
    render(<AppSettingsScreen />);
    // A loading branch that returns a bare View leaves the user on a blank
    // screen with no way off it while a request stalls.
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
          showTutorials: true,
          storeMode: false,
          budgetAndPrices: null,
        },
        loading: true,
        hasLoadedSettings: true,
        updateAppSetting: mockUpdateAppSetting,
        resetToDefaults: mockResetToDefaults,
      });

    render(<AppSettingsScreen />);

    expect(screen.queryByText('Loading settings...')).toBeNull();
    expect(screen.getByTestId('settings-screen')).toBeTruthy();
    expect(
      screen.getByTestId(profileTestIDs.settingsShowTutorialsSwitch),
    ).toBeTruthy();
  });
});
