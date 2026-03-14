'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { DietaryProfileScreen } from '../DietaryProfileScreen';

// --- Mocks ---

const mockUpdateDietaryProfile = jest.fn().mockResolvedValue(true);
const mockAddDietaryRestriction = jest.fn().mockResolvedValue(true);
const mockRemoveDietaryRestriction = jest.fn().mockResolvedValue(true);

jest.mock('#hooks/profile/useDietaryProfile', () => ({
  useDietaryProfile: () => ({
    profile: {
      restrictions: [],
      preferredCuisines: ['ITALIAN', 'MEXICAN'],
      favoriteIngredients: ['Garlic', 'Basil'],
      dislikedIngredients: ['Cilantro'],
      mealsPerDay: 3,
      snacksPerDay: 2,
      cookingSkillLevel: 'Intermediate',
      maxPrepTimeMinutes: 30,
      maxCookTimeMinutes: 45,
      budgetPerMeal: 15,
      calorieTarget: 2000,
      proteinTarget: 150,
      carbsTarget: 250,
      fatTarget: 70,
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

jest.mock('#/services/errorService', () => ({
  errorService: {
    reportError: jest.fn(),
  },
}));

jest.mock('#constants/animations', () => ({
  TIMING: { SLOW: 300 },
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#components/templates/ProfileScreenWrapper', () => {
  const { View, Text } = require('react-native');
  return {
    ProfileScreenWrapper: ({ children, title }: any) => (
      <View testID="profile-screen-wrapper">
        <Text>{title}</Text>
        {children}
      </View>
    ),
  };
});

jest.mock('#/components/organisms/DietaryRestrictionSelector', () => {
  const { View, Text } = require('react-native');
  return {
    DietaryRestrictionSelector: () => (
      <View testID="dietary-restriction-selector">
        <Text>DietaryRestrictionSelector</Text>
      </View>
    ),
  };
});

jest.mock('#/components/organisms/CuisineSelector', () => {
  const { View, Text } = require('react-native');
  return {
    CuisineSelector: ({ selectedCuisines }: any) => (
      <View testID="cuisine-selector">
        <Text>CuisineSelector</Text>
        <Text>{selectedCuisines.join(', ')}</Text>
      </View>
    ),
  };
});

jest.mock(
  '#/components/organisms/StringArrayManager/StringArrayManager',
  () => {
    const { View, Text } = require('react-native');
    return {
      StringArrayManager: ({ title, items }: any) => (
        <View testID={`string-array-${title}`}>
          <Text>{title}</Text>
          {items
            ? items.map((item: string) => <Text key={item}>{item}</Text>)
            : null}
        </View>
      ),
    };
  },
);

jest.mock('#/components/modals/NumberInputSheet/NumberInputSheet', () => {
  const { View } = require('react-native');
  return {
    NumberInputSheet: ({ visible, title }: any) =>
      visible ? <View testID={`sheet-${title}`} /> : null,
  };
});

jest.mock('#/components/molecules/InfoRow', () => {
  const { View, Text } = require('react-native');
  return {
    InfoRow: ({ label, value }: any) => (
      <View testID={`info-row-${label}`}>
        <Text>{label}</Text>
        <Text>{String(value)}</Text>
      </View>
    ),
  };
});

jest.mock(
  '#/components/modals/CookingPreferencesSheet/CookingPreferencesSheet',
  () => ({
    CookingPreferencesSheet: () => null,
  }),
);

jest.mock('#/components/modals/MacroTargetsSheet/MacroTargetsSheet', () => ({
  MacroTargetsSheet: () => null,
}));

describe('DietaryProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('renders Food Preferences section', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Food Preferences')).toBeTruthy();
  });

  it('renders CuisineSelector with selected cuisines', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByTestId('cuisine-selector')).toBeTruthy();
    expect(screen.getByText('ITALIAN, MEXICAN')).toBeTruthy();
  });

  it('renders Favorite Ingredients', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Favorite Ingredients')).toBeTruthy();
    expect(screen.getByText('Garlic')).toBeTruthy();
    expect(screen.getByText('Basil')).toBeTruthy();
  });

  it('renders Disliked Ingredients', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Disliked Ingredients')).toBeTruthy();
    expect(screen.getByText('Cilantro')).toBeTruthy();
  });

  it('renders Nutrition Goals section', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Nutrition Goals')).toBeTruthy();
    expect(screen.getByText('Meals per day')).toBeTruthy();
    expect(screen.getByText('Snacks per day')).toBeTruthy();
  });

  it('renders Cooking Preferences section', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Cooking Preferences')).toBeTruthy();
    expect(screen.getByText('Skill Level')).toBeTruthy();
    expect(screen.getByText('Intermediate')).toBeTruthy();
  });

  it('renders Macro Targets section', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Macro Targets (Advanced)')).toBeTruthy();
    expect(screen.getByText('Daily Calories')).toBeTruthy();
    expect(screen.getByText('2000')).toBeTruthy();
  });
});

describe('DietaryProfileScreen - loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(require('#hooks/profile/useDietaryProfile'), 'useDietaryProfile')
      .mockReturnValue({
        profile: null,
        loading: true,
        updateDietaryProfile: mockUpdateDietaryProfile,
        addDietaryRestriction: mockAddDietaryRestriction,
        removeDietaryRestriction: mockRemoveDietaryRestriction,
      });
  });

  it('shows loading text when dietary profile is loading', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Loading dietary profile...')).toBeTruthy();
  });
});

describe('DietaryProfileScreen - no profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(require('#hooks/profile/useDietaryProfile'), 'useDietaryProfile')
      .mockReturnValue({
        profile: null,
        loading: false,
        updateDietaryProfile: mockUpdateDietaryProfile,
        addDietaryRestriction: mockAddDietaryRestriction,
        removeDietaryRestriction: mockRemoveDietaryRestriction,
      });
  });

  it('shows empty state when no profile exists', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('No Dietary Profile')).toBeTruthy();
  });
});

describe('DietaryProfileScreen - partial profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(require('#hooks/profile/useDietaryProfile'), 'useDietaryProfile')
      .mockReturnValue({
        profile: {
          restrictions: [{ type: 'VEGETARIAN', severity: 'STRICT' }],
          preferredCuisines: [],
          favoriteIngredients: [],
          dislikedIngredients: [],
          mealsPerDay: null,
          snacksPerDay: null,
          cookingSkillLevel: null,
          maxPrepTimeMinutes: null,
          maxCookTimeMinutes: null,
          budgetPerMeal: null,
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

  it('renders with restrictions but no cuisines or ingredients', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Dietary Restrictions')).toBeTruthy();
    expect(screen.getByText('Food Preferences')).toBeTruthy();
  });

  it('renders nutrition goals with null values', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Nutrition Goals')).toBeTruthy();
  });

  it('renders cooking preferences with null skill level', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Cooking Preferences')).toBeTruthy();
  });

  it('renders nutrition goals section heading', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByText('Nutrition Goals')).toBeTruthy();
  });

  it('renders food preferences section with empty arrays', () => {
    render(<DietaryProfileScreen />);
    expect(screen.getByTestId('cuisine-selector')).toBeTruthy();
  });
});
