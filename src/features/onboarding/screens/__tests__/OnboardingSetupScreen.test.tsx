'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import type { OnboardingSetupOutcome } from '#features/onboarding/hooks/useOnboardingSetup';
import {
  initialOnboardingProgress,
  useOnboardingProgressStore,
  useOnboardingSetupStore,
} from '#features/onboarding/store/onboardingProgressStore';
import { OnboardingSetupScreen } from '../OnboardingSetupScreen';

const mockRun = jest.fn<
  Promise<OnboardingSetupOutcome>,
  [{ createMissingHome: boolean }]
>();
jest.mock('#features/onboarding/hooks/useOnboardingSetup', () => ({
  ...jest.requireActual('#features/onboarding/hooks/useOnboardingSetup'),
  useOnboardingSetup: () => ({ run: mockRun }),
}));

jest.mock('../useOnboardingInvites', () => ({
  useOnboardingInvites: () => ({ invites: [{ id: 'invite-1' }] }),
}));
jest.mock('#features/onboarding/components/InviteCard', () => ({
  InviteCard: () => {
    const { Text } = require('react-native');
    return <Text>Invite card</Text>;
  },
}));

const mockNavigateToNextStep = jest.fn();
jest.mock('../useOnboardingNavigation', () => ({
  useOnboardingNavigation: () => ({
    navigateToNextStep: mockNavigateToNextStep,
  }),
}));

jest.mock('#features/onboarding/components/OnboardingStepScaffold', () =>
  require('#/test-utils/onboardingStepScaffold'),
);

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress });
  useOnboardingSetupStore.setState({ setup: { kind: 'reading' } });
  // Never answers: the questions go on while setup runs.
  mockRun.mockReturnValue(new Promise(() => {}));
});

describe('OnboardingSetupScreen', () => {
  it('shows the pending invitations', () => {
    render(<OnboardingSetupScreen />);

    expect(screen.getByText('Invite card')).toBeTruthy();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('creates a home of their own, then goes on to the questions at once', async () => {
    const user = userEvent.setup();
    render(<OnboardingSetupScreen />);

    await user.press(screen.getByTestId(onboardingTestIDs.setupCreateHome));

    expect(mockRun).toHaveBeenCalledWith({ createMissingHome: true });
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('OnboardingSetup');
    expect(useOnboardingSetupStore.getState().setup).toEqual({
      kind: 'running',
      createMissingHome: true,
    });
  });

  it('skips creating a home when the user chooses to', async () => {
    const user = userEvent.setup();
    render(<OnboardingSetupScreen />);

    await user.press(screen.getByTestId(onboardingTestIDs.setupSkipHome));

    expect(mockRun).toHaveBeenCalledWith({ createMissingHome: false });
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('OnboardingSetup');
  });
});
