'use no memo';
import React from 'react';
import {
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { t } from '#/i18n';
import {
  Diet,
  ReligiousDiet,
  Intolerance,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { DietaryStepScreen } from '../DietaryStepScreen';
import { drainTimers } from '#/test-utils/drainTimers';
import { STEP_PRIMARY } from '#/test-utils/onboardingStepScaffold';

const mockSave = jest.fn().mockResolvedValue(true);
let mockHeld: unknown = null;
jest.mock('#features/onboarding/hooks/useDietaryIntake', () => ({
  useDietaryIntake: () => ({ save: mockSave, held: mockHeld }),
}));

let mockHomes = [{ id: 'home-1', name: 'Maya Home', shared: true }];
jest.mock('#features/profile/hooks/useDietarySharing', () => ({
  useDietarySharing: () => ({ homes: mockHomes, setShared: jest.fn() }),
}));

// The shared avoid sheet: its search and severity are tested in profile.
jest.mock('#features/profile/ui/AvoidFoodSheet', () => ({
  AvoidFoodSheet: ({
    visible,
    onPick,
  }: {
    visible: boolean;
    onPick: (
      food: { id: string; name: string },
      severity: string,
    ) => Promise<boolean>;
  }) => {
    const { Pressable, Text } = require('react-native');
    return visible ? (
      <Pressable
        onPress={() => {
          void onPick({ id: 'bacon', name: 'Bacon' }, 'ALLERGY');
        }}
      >
        <Text>Sheet result: Bacon</Text>
      </Pressable>
    ) : null;
  },
}));

const mockNavigateToNextStep = jest.fn();
jest.mock('../useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
    navigateToPreviousStep: jest.fn(),
  }),
}));

jest.mock('#features/onboarding/components/OnboardingStepScaffold', () =>
  require('#/test-utils/onboardingStepScaffold'),
);

const label = (key: Parameters<typeof t>[0]) => t(key);

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockHomes = [{ id: 'home-1', name: 'Maya Home', shared: true }];
});

async function continueStep(user: ReturnType<typeof userEvent.setup>) {
  await user.press(screen.getByTestId(STEP_PRIMARY));
  await drainTimers();
  expect(mockSave).toHaveBeenCalled();
  return mockSave.mock.calls[0]?.[0];
}

describe('DietaryStepScreen — the primary button and the notices', () => {
  it('reads "Nothing to avoid" with nothing picked', () => {
    render(<DietaryStepScreen />);

    expect(screen.getByTestId(STEP_PRIMARY)).toHaveTextContent(
      'Nothing to avoid',
    );
  });

  it('says how many choices it saves', async () => {
    const user = userEvent.setup();
    render(<DietaryStepScreen />);

    await user.press(screen.getByText(label('recipes.intolerance.PEANUT')));
    await user.press(screen.getByText(label('labels.vegetarian')));

    expect(screen.getByTestId(STEP_PRIMARY)).toHaveTextContent(
      'Save 2 choices',
    );
  });

  it('shows its notices after the choices', () => {
    render(<DietaryStepScreen />);

    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf(t('dietaryProfile.avoidTitle'))).toBeLessThan(
      tree.indexOf(t('dietaryAlerts.checkLabel')),
    );
  });
});

describe('DietaryStepScreen', () => {
  it('lists the nine major US allergens first', () => {
    render(<DietaryStepScreen />);
    const firstNine = [
      'recipes.intolerance.DAIRY',
      'dietaryProfile.intolerances.egg',
      'recipes.intolerance.FISH',
      'recipes.intolerance.SHELLFISH',
      'recipes.intolerance.TREE_NUT',
      'recipes.intolerance.PEANUT',
      'recipes.intolerance.WHEAT',
      'recipes.intolerance.SOY',
      'recipes.intolerance.SESAME',
    ] as const;
    const labels = screen
      .getAllByRole('button')
      .map(node => within(node).queryByText(/./)?.props.children)
      .filter((text): text is string => typeof text === 'string');
    expect(labels.slice(0, 9)).toEqual(firstNine.map(key => label(key)));
  });

  it('starts with what was saved before a restart, and says what it showed', async () => {
    const before = {
      allergens: [
        { value: Intolerance.Peanut, severity: RestrictionSeverity.Allergy },
      ],
      diets: [Diet.Vegetarian],
      foods: [],
      religiousDiet: null,
    };
    mockHeld = before;
    const user = userEvent.setup();
    render(<DietaryStepScreen />);

    await user.press(screen.getByText(label('labels.vegetarian')));
    const saved = await continueStep(user);

    // Vegetarian deselected: the save may remove it, since it was shown.
    expect(saved).toEqual({ ...before, diets: [] });
    expect(mockSave.mock.calls[0]?.[1]).toEqual(before);
    mockHeld = null;
  });

  it('saves a private religious diet beside a diet', async () => {
    const user = userEvent.setup();
    render(<DietaryStepScreen />);

    await user.press(screen.getByText(label('labels.vegetarian')));
    await user.press(screen.getByText(label('recipes.religiousDiet.KOSHER')));
    const saved = await continueStep(user);

    expect(saved.diets).toEqual([Diet.Vegetarian]);
    expect(saved.religiousDiet).toBe(ReligiousDiet.Kosher);
    expect(
      screen.getByText(label('dietaryProfile.religiousDietPrivate')),
    ).toBeTruthy();
  });

  it('clears the religious diet on a second tap', async () => {
    const user = userEvent.setup();
    render(<DietaryStepScreen />);

    await user.press(screen.getByText(label('recipes.religiousDiet.HALAL')));
    await user.press(screen.getByText(label('recipes.religiousDiet.HALAL')));
    const saved = await continueStep(user);

    expect(saved.religiousDiet).toBeNull();
  });

  it('starts with nothing selected', async () => {
    const user = userEvent.setup();
    render(<DietaryStepScreen />);

    const saved = await continueStep(user);

    expect(saved).toEqual({
      allergens: [],
      diets: [],
      foods: [],
      religiousDiet: null,
    });
  });

  it('saves peanuts as an allergy', async () => {
    const user = userEvent.setup();
    render(<DietaryStepScreen />);

    await user.press(screen.getByText(label('recipes.intolerance.PEANUT')));
    const saved = await continueStep(user);

    expect(saved.allergens).toEqual([
      { value: Intolerance.Peanut, severity: RestrictionSeverity.Allergy },
    ]);
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Dietary');
  });

  it('saves milk as an intolerance once switched', async () => {
    const user = userEvent.setup();
    render(<DietaryStepScreen />);

    await user.press(screen.getByText(label('recipes.intolerance.DAIRY')));
    const control = screen.getByTestId(
      onboardingTestIDs.dietarySeverity(Intolerance.Dairy),
    );
    await user.press(
      within(control).getByText(
        label('dietaryProfile.avoidSeverity.intolerance'),
      ),
    );
    const saved = await continueStep(user);

    expect(saved.allergens).toEqual([
      { value: Intolerance.Dairy, severity: RestrictionSeverity.Intolerance },
    ]);
  });

  it('keeps one animal-food diet, with an eating style beside it', async () => {
    const user = userEvent.setup();
    render(<DietaryStepScreen />);

    await user.press(screen.getByText(label('labels.vegetarian')));
    await user.press(screen.getByText(label('recipes.diet.KETO')));
    await user.press(screen.getByText(label('labels.vegan')));
    const saved = await continueStep(user);

    expect(saved.diets).toEqual([Diet.Keto, Diet.Vegan]);
  });

  it('adds a food from the avoid sheet, with the severity it chose', async () => {
    const user = userEvent.setup();
    render(<DietaryStepScreen />);

    expect(screen.queryByText('Sheet result: Bacon')).toBeNull();
    await user.press(screen.getByTestId(onboardingTestIDs.dietaryAddFood));
    await user.press(screen.getByText('Sheet result: Bacon'));
    const saved = await continueStep(user);

    expect(saved.foods).toEqual([
      { id: 'bacon', name: 'Bacon', severity: RestrictionSeverity.Allergy },
    ]);
  });

  it('has no text field of its own, so the keyboard never covers Continue', () => {
    render(<DietaryStepScreen />);

    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('says alerts can be wrong, in body text', () => {
    render(<DietaryStepScreen />);

    expect(
      screen.UNSAFE_getByProps({
        role: 'body',
        children: t('dietaryAlerts.checkLabel'),
      }),
    ).toBeTruthy();
  });

  it('names the homes that see the answers', () => {
    render(<DietaryStepScreen />);

    expect(
      screen.getByText(
        t('onBoarding.dietarySharedWith', { homes: 'Maya Home' }),
      ),
    ).toBeTruthy();
  });

  it('says how sharing works when no home is shared', () => {
    mockHomes = [];
    render(<DietaryStepScreen />);

    expect(
      screen.getByText(t('onBoarding.dietarySharingGeneric')),
    ).toBeTruthy();
  });

  it('saves nothing when skipped', async () => {
    const user = userEvent.setup();
    render(<DietaryStepScreen />);

    await user.press(screen.getByText(label('recipes.intolerance.PEANUT')));
    await user.press(screen.getByText('Skip'));

    expect(mockSave).not.toHaveBeenCalled();
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Dietary');
  });

  it('stays on the step and says so when a choice is refused', async () => {
    mockSave.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    render(<DietaryStepScreen />);

    await continueStep(user);

    await drainTimers();
    expect(screen.getByText(t('onBoarding.dietarySaveFailed'))).toBeTruthy();
    expect(mockNavigateToNextStep).not.toHaveBeenCalled();
  });
});
