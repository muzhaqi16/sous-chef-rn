'use no memo';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
import { DietaryProfileScreen } from '../DietaryProfileScreen';
import { ReligiousDiet } from '#/graphql/generated/schemaTypes';

// --- Mocks ---

const mockUpdateDietaryProfile = jest.fn().mockResolvedValue(true);
const mockAddDietaryRestriction = jest.fn().mockResolvedValue(true);
const mockRemoveDietaryRestriction = jest.fn().mockResolvedValue(true);
const mockRefetch = jest.fn().mockResolvedValue({});

jest.mock('#features/profile/hooks/useDietaryProfile', () => ({
  useDietaryProfile: () => ({
    editableProfile: {
      restrictions: [],
      maxCookTimeMinutes: 45,
      calorieTarget: 2000,
      proteinTarget: 150,
      carbsTarget: 250,
      fatTarget: 70,
      religiousDiet: 'KOSHER',
    },
    loading: false,
    updateDietaryProfile: mockUpdateDietaryProfile,
    addDietaryRestriction: mockAddDietaryRestriction,
    removeDietaryRestriction: mockRemoveDietaryRestriction,
  }),
}));

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    loadingContainer: {},
    loadingText: {},
    subtitle: {},
    emptyState: {},
    emptyStateTitle: {},
    emptyStateText: {},
  },
}));

jest.mock('#/services/errorService');

jest.mock('#constants/animations', () => ({}));

jest.mock('#components/atoms/Icon', () => ({
  Icon: 'Icon',
}));

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#components/templates/SubScreen', () => {
  const { View, Text } = require('react-native');
  return {
    SubScreen: ({
      children,
      title,
    }: {
      children?: React.ReactNode;
      title?: string;
    }) => (
      <View testID="profile-screen-wrapper">
        <Text>{title}</Text>
        {children}
      </View>
    ),
  };
});

jest.mock('#features/profile/components/DietaryRestrictionSelector', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    DietaryRestrictionSelector: ({
      onRemove,
    }: {
      onRemove: (item: { id: string; label: string }) => void;
    }) => (
      <View testID="dietary-restriction-selector">
        <Text>DietaryRestrictionSelector</Text>
        <Pressable
          testID="remove-bacon"
          onPress={() => onRemove({ id: 'r-bacon', label: 'bacon' })}
        />
      </View>
    ),
  };
});

jest.mock('#components/atoms/InfoRow', () => {
  const { View, Text } = require('react-native');
  return {
    InfoRow: ({
      label,
      value,
    }: {
      label: string;
      value: string | number | null | undefined;
    }) => (
      <View testID={`info-row-${label}`}>
        <Text>{label}</Text>
        <Text>{String(value)}</Text>
      </View>
    ),
  };
});

jest.mock(
  '#features/profile/components/CookingPreferencesSheet/CookingPreferencesSheet',
  () => ({
    CookingPreferencesSheet: () => null,
  }),
);

jest.mock(
  '#features/profile/components/MacroTargetsSheet/MacroTargetsSheet',
  () => ({
    MacroTargetsSheet: () => null,
  }),
);

const mockSetShared = jest.fn().mockResolvedValue(undefined);
const mockSharingHomes: { id: string; name: string; shared: boolean }[] = [];
jest.mock('#features/profile/hooks/useDietarySharing', () => ({
  useDietarySharing: () => ({
    homes: mockSharingHomes,
    setShared: mockSetShared,
  }),
}));

describe('DietaryProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSharingHomes.length = 0;
  });

  it('offers no sharing section to a user with no home', () => {
    render(<DietaryProfileScreen />);
    expect(screen.queryByText('Shared with')).toBeNull();
  });

  it('lists a switch for each of the user’s homes', () => {
    mockSharingHomes.push(
      { id: 'home-1', name: 'Test Home', shared: true },
      { id: 'home-2', name: 'Beach House', shared: false },
    );
    render(<DietaryProfileScreen />);

    expect(screen.getByText('Shared with')).toBeTruthy();
    expect(screen.getByTestId('dietary-sharing-switch-home-1')).toBeTruthy();
    expect(screen.getByTestId('dietary-sharing-switch-home-2')).toBeTruthy();
  });

  it('changes the religious diet chosen in onboarding, or clears it', async () => {
    const user = userEvent.setup();
    render(<DietaryProfileScreen />);

    await user.press(screen.getByText(t('recipes.religiousDiet.KOSHER')));
    expect(mockUpdateDietaryProfile).toHaveBeenLastCalledWith({
      religiousDiet: null,
    });

    await user.press(screen.getByText(t('recipes.religiousDiet.HALAL')));
    expect(mockUpdateDietaryProfile).toHaveBeenLastCalledWith({
      religiousDiet: ReligiousDiet.Halal,
    });
  });

  it('renders the screen with title', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Dietary Profile')).toBeTruthy();
  });

  it('renders Dietary Restrictions section', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Dietary Restrictions')).toBeTruthy();
    expect(screen.getByTestId('dietary-restriction-selector')).toBeTruthy();
  });

  // Named as its row shows it, an avoided food included.
  it('names the restriction it asks to remove', () => {
    const alert = jest.spyOn(alertService, 'alert');
    render(<DietaryProfileScreen />);

    fireEvent.press(screen.getByTestId('remove-bacon'));

    expect(alert).toHaveBeenCalledWith(
      'Remove bacon?',
      expect.any(String),
      expect.any(Array),
    );
    alert.mockRestore();
  });

  it('shows the longest cooking time, which Recipes search filters by', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Cooking Preferences')).toBeTruthy();
    expect(screen.getByText(t('labels.maxCookTime'))).toBeTruthy();
    expect(screen.getByText('45')).toBeTruthy();
  });

  // Only what something reads is offered.
  it('offers no setting nothing reads', () => {
    render(<DietaryProfileScreen />);
    expect(screen.queryByText('Food Preferences')).toBeNull();
    expect(screen.queryByText('Nutrition Goals')).toBeNull();
    expect(screen.queryByText('Favorite Ingredients')).toBeNull();
    expect(screen.queryByText('Disliked Ingredients')).toBeNull();
    expect(screen.queryByText('Skill Level')).toBeNull();
  });

  it('renders Macro Targets section', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Macro Targets (Advanced)')).toBeTruthy();
    expect(screen.getByText('Daily Calories')).toBeTruthy();
    expect(screen.getByText('2000')).toBeTruthy();
  });
});

/**
 * The gate is `loading && !profile`, not `loading`. Under `cache-and-network`
 * Apollo reports `loading: true` for the whole network leg on EVERY mount, so
 * gating on `loading` alone blanked this screen on every visit for as long as
 * the request took — up to the 10s httpLink abort deadline.
 */
describe('DietaryProfileScreen - loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(
        require('#features/profile/hooks/useDietaryProfile'),
        'useDietaryProfile',
      )
      .mockReturnValue({
        editableProfile: null,
        loading: true,
        updateDietaryProfile: mockUpdateDietaryProfile,
        addDietaryRestriction: mockAddDietaryRestriction,
        removeDietaryRestriction: mockRemoveDietaryRestriction,
      });
  });

  it('shows loading text when there is no profile yet', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Loading dietary profile...')).toBeTruthy();
  });

  it('keeps the header and back button while it waits', () => {
    render(<DietaryProfileScreen />);
    // A loading branch that returns a bare View leaves the user on a blank
    // screen with no way off it while a request stalls.
    expect(screen.getByTestId('profile-screen-wrapper')).toBeTruthy();
    expect(screen.getByText('Dietary Profile')).toBeTruthy();
  });

  it('renders the profile while a background refresh is in flight', () => {
    jest
      .spyOn(
        require('#features/profile/hooks/useDietaryProfile'),
        'useDietaryProfile',
      )
      .mockReturnValue({
        editableProfile: {
          restrictions: [],
          maxCookTimeMinutes: 45,
          calorieTarget: 2000,
          proteinTarget: 150,
          carbsTarget: 250,
          fatTarget: 70,
        },
        loading: true,
        updateDietaryProfile: mockUpdateDietaryProfile,
        addDietaryRestriction: mockAddDietaryRestriction,
        removeDietaryRestriction: mockRemoveDietaryRestriction,
      });

    render(<DietaryProfileScreen />);

    expect(screen.queryByText('Loading dietary profile...')).toBeNull();
    expect(screen.getByText('Dietary Profile')).toBeTruthy();
  });
});

describe('DietaryProfileScreen - profile never read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(
        require('#features/profile/hooks/useDietaryProfile'),
        'useDietaryProfile',
      )
      .mockReturnValue({
        editableProfile: null,
        loading: false,
        state: 'error',
        refetch: mockRefetch,
        updateDietaryProfile: mockUpdateDietaryProfile,
        addDietaryRestriction: mockAddDietaryRestriction,
        removeDietaryRestriction: mockRemoveDietaryRestriction,
      });
  });

  it('says the profile could not be loaded and offers to read it again', async () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText(t('dataState.errorTitle'))).toBeTruthy();

    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

describe('DietaryProfileScreen - partial profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(
        require('#features/profile/hooks/useDietaryProfile'),
        'useDietaryProfile',
      )
      .mockReturnValue({
        editableProfile: {
          restrictions: [{ type: 'VEGETARIAN', severity: 'STRICT' }],
          maxCookTimeMinutes: null,
          calorieTarget: null,
          proteinTarget: null,
          carbsTarget: null,
          fatTarget: null,
        },
        loading: false,
        updateDietaryProfile: mockUpdateDietaryProfile,
        addDietaryRestriction: mockAddDietaryRestriction,
        removeDietaryRestriction: mockRemoveDietaryRestriction,
      });
  });

  it('offers to set macro targets when none is set yet', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Macro Targets (Advanced)')).toBeTruthy();
    expect(screen.getByText('No targets set yet')).toBeTruthy();
    expect(screen.getByLabelText('Edit Macro Targets')).toBeTruthy();
  });

  it('says when no cooking time limit is set', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Cooking Preferences')).toBeTruthy();
    expect(screen.getByText(t('dietary.cookTimeEmpty'))).toBeTruthy();
  });
});
