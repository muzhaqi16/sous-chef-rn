'use no memo';
import React from 'react';
import { act, screen, userEvent } from '@testing-library/react-native';
import type { ApolloCache } from '@apollo/client';
import { t } from '#/i18n';
import { makeCache } from '#/apollo/cache';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { memoryScreen } from '#/test-utils/memoryPlatform';
import {
  GetDietaryProfileDocument,
  UpdateDietaryProfileDocument,
} from '#operations/user/user.generated';
import { useStore } from '#store';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingProgressStore } from '#features/onboarding/store/onboardingProgressStore';
import { HouseholdStepScreen } from '../HouseholdStepScreen';
import { HouseholdGreetingHomeDocument } from '#features/onboarding/hooks/useHouseholdGreeting.generated';
import { MembershipRole } from '#/graphql/generated/schemaTypes';

const mockNavigateToNextStep = jest.fn();
jest.mock('../useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
  }),
}));

jest.mock('#features/onboarding/components/OnboardingStepScaffold', () =>
  require('#/test-utils/onboardingStepScaffold'),
);

const profileMock = (cooksFor: number | null = null) =>
  recordMock(GetDietaryProfileDocument, {
    data: {
      me: {
        id: 'user-1',
        dietaryProfile: { id: 'dp-1', cooksFor, restrictions: [] },
      },
    },
  });

// Offline, the local-first write is queued: the queue link answers null.
const queuedUpdate = () =>
  recordMock(UpdateDietaryProfileDocument, {
    data: { updateDietaryProfile: null },
    partial: true,
  });

const cachedCooksFor = (cache: ApolloCache) =>
  (cache.extract(true) as Record<string, { cooksFor?: number | null }>)[
    'DietaryProfile:dp-1'
  ]?.cooksFor;

/** The selected home as the greeting reads it, the user in `role`. */
const greetingHome = (name: string, role: MembershipRole) =>
  recordMock(HouseholdGreetingHomeDocument, {
    data: {
      home: {
        id: 'home-1',
        name,
        myMembership: { id: 'm-1', role },
      },
    },
  });

async function renderStep(
  update = queuedUpdate(),
  savedCooksFor: number | null = null,
  home = greetingHome("Maya's home", MembershipRole.Owner),
) {
  const cache = makeCache();
  renderWithApollo(<HouseholdStepScreen />, {
    cache,
    operationMocks: [profileMock(savedCooksFor).mock, update.mock, home.mock],
  });
  await drainTimers();
  expect(cachedCooksFor(cache)).toBe(savedCooksFor);
  return { cache, update };
}

const checked = (choice: 'one' | 'two' | 'family') =>
  screen.getByTestId(onboardingTestIDs.householdChoice(choice)).props
    .accessibilityState?.checked;

const recordedCooksFor = () => useOnboardingProgressStore.getState().cooksFor;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingProgressStore.setState({ cooksFor: null });
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'maya@example.com',
      emailVerified: true,
      onBoarded: false,
      firstName: 'Maya',
    },
    selectedHomeId: 'home-1',
  });
});

afterEach(() => useStore.setState({ user: null }));

describe('HouseholdStepScreen — the greeting', () => {
  it('greets the user by first name, with the home they can rename', async () => {
    const user = userEvent.setup();
    await renderStep();

    expect(screen.getByText('Welcome, Maya')).toBeTruthy();
    expect(screen.getByText(t('onBoarding.householdTitle'))).toBeTruthy();
    await user.press(screen.getByTestId(onboardingTestIDs.householdHomeName));
    expect(screen.getByText(t('onBoarding.renameHomeTitle'))).toBeTruthy();
  });

  it('greets without a name when the account has none', async () => {
    useStore.setState({
      user: {
        id: 'user-1',
        email: 'maya@example.com',
        emailVerified: true,
        onBoarded: false,
      },
    });
    await renderStep(
      queuedUpdate(),
      null,
      greetingHome('My home', MembershipRole.Owner),
    );

    expect(screen.getByText(t('onBoarding.greetingNoName'))).toBeTruthy();
    expect(screen.getByText('My home')).toBeTruthy();
  });

  it('names a joined home without offering to rename it', async () => {
    await renderStep(
      queuedUpdate(),
      null,
      greetingHome("Sam's home", MembershipRole.Member),
    );

    const name = screen.getByTestId(onboardingTestIDs.householdHomeName);
    expect(name).toHaveTextContent("Sam's home");
    expect(name.props.accessibilityRole).not.toBe('button');
  });
});

describe('HouseholdStepScreen — setup still running', () => {
  it('is answered and saved before the home exists', async () => {
    // Setup creates the home beside this question: nothing is selected yet.
    useStore.setState({ selectedHomeId: null });
    const user = userEvent.setup();
    const { update } = await renderStep();

    expect(screen.getByText('Welcome, Maya')).toBeTruthy();
    expect(screen.queryByText("Maya's home")).toBeNull();
    await user.press(
      screen.getByTestId(onboardingTestIDs.householdChoice('two')),
    );

    await drainTimers();
    expect(update.fired).toEqual([{ input: { cooksFor: 2 } }]);
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Household');
  });
});

describe('HouseholdStepScreen — answers already saved', () => {
  it('shows "Two of us" chosen when it was saved before a restart', async () => {
    await renderStep(queuedUpdate(), 2);

    expect(checked('two')).toBe(true);
    expect(checked('one')).toBe(false);
  });

  it('reopens a saved family with its count', async () => {
    await renderStep(queuedUpdate(), 5);

    expect(checked('family')).toBe(true);
    expect(
      screen.getByText(t('onBoarding.householdPeople', { count: 5 })),
    ).toBeTruthy();
  });
});

describe('HouseholdStepScreen', () => {
  it('answers "just me" in one tap, saves it to the profile and moves on', async () => {
    const user = userEvent.setup();
    const { cache, update } = await renderStep();

    await user.press(
      screen.getByTestId(onboardingTestIDs.householdChoice('one')),
    );

    await drainTimers();
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Household');
    expect(recordedCooksFor()).toBe(1);
    expect(cachedCooksFor(cache)).toBe(1);
    expect(update.fired).toEqual([{ input: { cooksFor: 1 } }]);
  });

  it('answers "two of us" in one tap', async () => {
    const user = userEvent.setup();
    const { update } = await renderStep();

    await user.press(
      screen.getByTestId(onboardingTestIDs.householdChoice('two')),
    );

    await drainTimers();
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Household');
    expect(update.fired).toEqual([{ input: { cooksFor: 2 } }]);
    expect(recordedCooksFor()).toBe(2);
  });

  it('saves a family of four offline: cached at once, queued for replay', async () => {
    const user = userEvent.setup();
    const { cache, update } = await renderStep();

    await user.press(
      screen.getByTestId(onboardingTestIDs.householdChoice('family')),
    );
    expect(
      screen.getByText(t('onBoarding.householdPeople', { count: 4 })),
    ).toBeTruthy();
    expect(mockNavigateToNextStep).not.toHaveBeenCalled();

    await user.press(screen.getByText(t('labels.continue')));

    await drainTimers();
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Household');
    expect(cachedCooksFor(cache)).toBe(4);
    expect(update.fired).toEqual([{ input: { cooksFor: 4 } }]);
  });

  it('counts a family by tapping, never below three', async () => {
    const user = userEvent.setup();
    await renderStep();

    await user.press(
      screen.getByTestId(onboardingTestIDs.householdChoice('family')),
    );
    await user.press(screen.getByTestId(onboardingTestIDs.householdMore));
    expect(
      screen.getByText(t('onBoarding.householdPeople', { count: 5 })),
    ).toBeTruthy();

    for (let i = 0; i < 4; i++) {
      await user.press(screen.getByTestId(onboardingTestIDs.householdFewer));
    }
    expect(
      screen.getByText(t('onBoarding.householdPeople', { count: 3 })),
    ).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('takes a new answer when the person comes back to the step', async () => {
    const user = userEvent.setup();
    await renderStep(
      recordMock(UpdateDietaryProfileDocument, {
        data: { updateDietaryProfile: null },
        partial: true,
        maxUsageCount: 2,
      }),
    );

    await user.press(
      screen.getByTestId(onboardingTestIDs.householdChoice('two')),
    );
    await drainTimers();
    expect(mockNavigateToNextStep).toHaveBeenCalledTimes(1);

    // The next step covers this one, then goes back to it.
    act(() => memoryScreen().setFocused(false));
    act(() => memoryScreen().setFocused(true));

    await user.press(
      screen.getByTestId(onboardingTestIDs.householdChoice('one')),
    );
    await drainTimers();
    expect(mockNavigateToNextStep).toHaveBeenCalledTimes(2);
    expect(recordedCooksFor()).toBe(1);
  });

  it('records and writes nothing when skipped', async () => {
    const user = userEvent.setup();
    const { cache, update } = await renderStep();

    await user.press(screen.getByText('Skip'));

    expect(recordedCooksFor()).toBeNull();
    expect(update.fired).toEqual([]);
    expect(cachedCooksFor(cache)).toBeNull();
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('Household');
  });
});
