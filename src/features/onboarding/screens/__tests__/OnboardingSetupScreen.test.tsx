'use no memo';
import React from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { t } from '#/i18n';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import type { OnboardingSetupOutcome } from '#features/onboarding/hooks/useOnboardingSetup';
import { OnboardingSetupScreen } from '../OnboardingSetupScreen';

const mockRun = jest.fn<
  Promise<OnboardingSetupOutcome>,
  [{ createMissingHome: boolean }]
>();
let mockSetup = { loading: false, hasHome: false };
jest.mock('#features/onboarding/hooks/useOnboardingSetup', () => ({
  useOnboardingSetup: () => ({ ...mockSetup, run: mockRun }),
}));

let mockInvites: { id: string }[] = [];
jest.mock('../useOnboardingInvites', () => ({
  useOnboardingInvites: () => ({ invites: mockInvites, loading: false }),
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

jest.mock('#features/onboarding/components/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({
    title,
    children,
    primaryAction,
    testID,
  }: {
    title?: string;
    children?: React.ReactNode;
    primaryAction?: React.ReactNode;
    testID?: string;
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{title}</Text>
        {children}
        {primaryAction}
      </View>
    );
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSetup = { loading: false, hasHome: false };
  mockInvites = [];
  mockRun.mockResolvedValue({ status: 'done' });
});

describe('OnboardingSetupScreen', () => {
  it('sets up a new account without asking, then moves on', async () => {
    render(<OnboardingSetupScreen />);

    await waitFor(() =>
      expect(mockNavigateToNextStep).toHaveBeenCalledWith('OnboardingSetup'),
    );
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({ createMissingHome: true });
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('waits until the homes and lists have been read, claiming no setup yet', () => {
    mockSetup = { loading: true, hasHome: false };
    render(<OnboardingSetupScreen />);

    expect(mockRun).not.toHaveBeenCalled();
    expect(screen.queryByText(t('onBoarding.settingUpTitle'))).toBeNull();
  });

  it('says it is setting up once it is', async () => {
    mockRun.mockReturnValue(new Promise(() => {}));
    render(<OnboardingSetupScreen />);

    expect(
      await screen.findByText(t('onBoarding.settingUpTitle')),
    ).toBeTruthy();
  });

  it('offers pending invitations before creating a home', async () => {
    const user = userEvent.setup();
    mockInvites = [{ id: 'invite-1' }];
    render(<OnboardingSetupScreen />);

    expect(await screen.findByText('Invite card')).toBeTruthy();
    expect(mockRun).not.toHaveBeenCalled();

    await user.press(screen.getByTestId(onboardingTestIDs.setupCreateHome));
    await waitFor(() =>
      expect(mockRun).toHaveBeenCalledWith({ createMissingHome: true }),
    );
  });

  it('skips creating a home when the user chooses to', async () => {
    const user = userEvent.setup();
    mockInvites = [{ id: 'invite-1' }];
    render(<OnboardingSetupScreen />);

    await user.press(
      await screen.findByTestId(onboardingTestIDs.setupSkipHome),
    );
    await waitFor(() =>
      expect(mockRun).toHaveBeenCalledWith({ createMissingHome: false }),
    );
  });

  it('does not offer invitations to an account that already has a home', async () => {
    mockSetup = { loading: false, hasHome: true };
    mockInvites = [{ id: 'invite-1' }];
    render(<OnboardingSetupScreen />);

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Invite card')).toBeNull();
  });

  it('shows a refusal with Try again and Continue', async () => {
    const user = userEvent.setup();
    mockRun.mockResolvedValueOnce({
      status: 'failed',
      message: 'Home limit reached',
    });
    render(<OnboardingSetupScreen />);

    expect(await screen.findByText('Home limit reached')).toBeTruthy();
    expect(screen.getByText(t('onBoarding.setupFailedTitle'))).toBeTruthy();

    await user.press(screen.getByText(t('labels.tryAgain')));
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(mockNavigateToNextStep).toHaveBeenCalledWith('OnboardingSetup'),
    );
  });

  it('continues past a refusal when asked', async () => {
    const user = userEvent.setup();
    mockRun.mockResolvedValueOnce({ status: 'failed', message: 'Refused' });
    render(<OnboardingSetupScreen />);

    await user.press(await screen.findByText(t('labels.continue')));
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('OnboardingSetup');
    expect(mockRun).toHaveBeenCalledTimes(1);
  });
});
