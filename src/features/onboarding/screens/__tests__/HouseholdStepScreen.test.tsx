'use no memo';
import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ApolloCache } from '@apollo/client';
import { t } from '#/i18n';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  GetDietaryProfileDocument,
  UpdateDietaryProfileDocument,
} from '#operations/user/user.generated';
import { useStore } from '#store';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingProgressStore } from '#features/onboarding/store/onboardingProgressStore';
import { HouseholdStepScreen } from '../HouseholdStepScreen';

const mockNavigateToNextStep = jest.fn();
jest.mock('../useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
  }),
}));

jest.mock('#features/onboarding/components/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({
    children,
    onSkip,
    primaryAction,
  }: {
    children?: React.ReactNode;
    onSkip?: () => void;
    primaryAction?: React.ReactNode;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        {children}
        {primaryAction}
        <Pressable onPress={onSkip}>
          <Text>Skip</Text>
        </Pressable>
      </View>
    );
  },
}));

const profileMock = () =>
  recordMock(GetDietaryProfileDocument, {
    data: {
      me: {
        id: 'user-1',
        dietaryProfile: { id: 'dp-1', cooksFor: null, restrictions: [] },
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
  (cache.extract() as Record<string, { cooksFor?: number | null }>)[
    'DietaryProfile:dp-1'
  ]?.cooksFor;

async function renderStep(update = queuedUpdate()) {
  const cache = makeCache();
  renderWithApollo(<HouseholdStepScreen />, {
    cache,
    operationMocks: [profileMock().mock, update.mock],
  });
  await waitFor(() => expect(cachedCooksFor(cache)).toBeNull());
  return { cache, update };
}

const recordedCooksFor = () => useOnboardingProgressStore.getState().cooksFor;

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingProgressStore.setState({ cooksFor: null });
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'maya@example.com',
      emailVerified: true,
      onBoarded: false,
    },
  });
});

afterEach(() => useStore.setState({ user: null }));

describe('HouseholdStepScreen', () => {
  it('answers "just me" in one tap, saves it to the profile and moves on', async () => {
    const user = userEvent.setup();
    const { cache, update } = await renderStep();

    await user.press(
      screen.getByTestId(onboardingTestIDs.householdChoice('one')),
    );

    await waitFor(() =>
      expect(mockNavigateToNextStep).toHaveBeenCalledWith('Household'),
    );
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

    await waitFor(() =>
      expect(mockNavigateToNextStep).toHaveBeenCalledWith('Household'),
    );
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

    await waitFor(() =>
      expect(mockNavigateToNextStep).toHaveBeenCalledWith('Household'),
    );
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
