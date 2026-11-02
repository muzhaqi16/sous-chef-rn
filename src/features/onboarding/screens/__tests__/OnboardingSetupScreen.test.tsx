'use no memo';
import React from 'react';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { t } from '#/i18n';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import type { OnboardingSetupOutcome } from '#features/onboarding/hooks/useOnboardingSetup';
import type { DataState } from '#hooks/data/useDataState';
import { OnboardingSetupScreen } from '../OnboardingSetupScreen';
import { drainTimers } from '#/test-utils/drainTimers';

const mockRun = jest.fn<
  Promise<OnboardingSetupOutcome>,
  [{ createMissingHome: boolean }]
>();
let mockSetup: { loading: boolean; hasHome: boolean; readState?: DataState } = {
  loading: false,
  hasHome: false,
};
const mockRetryRead = jest.fn();
const mockSetOwed = jest.fn();
let mockAnswer = () => {};
jest.mock('#features/onboarding/hooks/useOnboardingSetup', () => ({
  useOnboardingSetup: () => {
    const [, setAnswers] = require('react').useState(0);
    mockAnswer = () => setAnswers((answers: number) => answers + 1);
    return {
      readState: 'empty',
      ...mockSetup,
      retryRead: mockRetryRead,
      run: mockRun,
      setOwed: mockSetOwed,
    };
  },
}));

let mockInvites: { id: string }[] = [];
let mockInvitesState: DataState = 'empty';
const mockRefetchInvites = jest.fn();
jest.mock('../useOnboardingInvites', () => ({
  useOnboardingInvites: () => ({
    invites: mockInvites,
    loading: false,
    state: mockInvitesState,
    refetch: mockRefetchInvites,
  }),
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
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSetup = { loading: false, hasHome: false };
  mockInvites = [];
  mockInvitesState = 'empty';
  mockRun.mockResolvedValue({ status: 'done' });
});

describe('OnboardingSetupScreen, what exists could not be read', () => {
  it('creates nothing and offers to read it again', async () => {
    const user = userEvent.setup();
    mockSetup = { loading: false, hasHome: false, readState: 'error' };
    render(<OnboardingSetupScreen />);

    await drainTimers();
    expect(mockRun).not.toHaveBeenCalled();
    expect(screen.getByText(t('dataState.errorTitle'))).toBeTruthy();

    await user.press(screen.getByText(t('labels.tryAgain')));
    expect(mockRetryRead).toHaveBeenCalledTimes(1);
    expect(mockRefetchInvites).toHaveBeenCalledTimes(1);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('never strands the account on the failure', async () => {
    const user = userEvent.setup();
    mockSetup = { loading: false, hasHome: false, readState: 'offline' };
    render(<OnboardingSetupScreen />);

    await user.press(screen.getByText(t('labels.continue')));
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('OnboardingSetup');
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockSetOwed).toHaveBeenCalledWith(true);
  });

  it('says setup finishes later, and asks nothing more of the person', () => {
    mockSetup = { loading: false, hasHome: false, readState: 'offline' };

    render(<OnboardingSetupScreen />);

    expect(screen.getByText(t('onBoarding.finishSetupLater'))).toBeTruthy();
  });

  it('runs by itself when the read answers on this step', async () => {
    mockSetup = { loading: false, hasHome: false, readState: 'offline' };
    render(<OnboardingSetupScreen />);

    mockSetup = { loading: false, hasHome: false, readState: 'empty' };
    await act(async () => {
      mockAnswer();
    });

    expect(mockRun).toHaveBeenCalledWith({ createMissingHome: true });
  });

  it('leaves a setup it went past to run only once, under the next step', async () => {
    const user = userEvent.setup();
    mockSetup = { loading: false, hasHome: false, readState: 'offline' };
    render(<OnboardingSetupScreen />);
    await user.press(screen.getByText(t('labels.continue')));

    mockSetup = { loading: false, hasHome: false, readState: 'empty' };
    await act(async () => {
      mockAnswer();
    });

    expect(mockRun).not.toHaveBeenCalled();
  });

  it('sets up once a retry answers', async () => {
    mockSetup = { loading: false, hasHome: false, readState: 'error' };
    render(<OnboardingSetupScreen />);
    await drainTimers();
    expect(mockRun).not.toHaveBeenCalled();

    mockSetup = { loading: false, hasHome: false, readState: 'empty' };
    act(() => mockAnswer());

    await drainTimers();
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({ createMissingHome: true });
  });

  it('will not make a home over invitations it could not read', async () => {
    mockInvitesState = 'error';
    render(<OnboardingSetupScreen />);

    await drainTimers();
    expect(mockRun).not.toHaveBeenCalled();
    expect(screen.getByText(t('dataState.errorTitle'))).toBeTruthy();
  });

  it('needs no invitations once the account has a home', async () => {
    mockSetup = { loading: false, hasHome: true, readState: 'ready' };
    mockInvitesState = 'error';
    render(<OnboardingSetupScreen />);

    await drainTimers();
    expect(mockRun).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingSetupScreen', () => {
  it('sets up a new account without asking, then moves on', async () => {
    render(<OnboardingSetupScreen />);

    await drainTimers();
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('OnboardingSetup');
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

    await drainTimers();
    expect(screen.getByText(t('onBoarding.settingUpTitle'))).toBeTruthy();
  });

  it('offers pending invitations before creating a home', async () => {
    const user = userEvent.setup();
    mockInvites = [{ id: 'invite-1' }];
    render(<OnboardingSetupScreen />);

    await drainTimers();
    expect(screen.getByText('Invite card')).toBeTruthy();
    expect(mockRun).not.toHaveBeenCalled();

    await user.press(screen.getByTestId(onboardingTestIDs.setupCreateHome));
    await drainTimers();
    expect(mockRun).toHaveBeenCalledWith({ createMissingHome: true });
  });

  it('skips creating a home when the user chooses to', async () => {
    const user = userEvent.setup();
    mockInvites = [{ id: 'invite-1' }];
    render(<OnboardingSetupScreen />);

    await drainTimers();
    await user.press(screen.getByTestId(onboardingTestIDs.setupSkipHome));
    await drainTimers();
    expect(mockRun).toHaveBeenCalledWith({ createMissingHome: false });
  });

  it('does not offer invitations to an account that already has a home', async () => {
    mockSetup = { loading: false, hasHome: true };
    mockInvites = [{ id: 'invite-1' }];
    render(<OnboardingSetupScreen />);

    await drainTimers();
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Invite card')).toBeNull();
  });

  it('shows a refusal with Try again and Continue', async () => {
    const user = userEvent.setup();
    mockRun.mockResolvedValueOnce({
      status: 'failed',
      message: 'Home limit reached',
    });
    render(<OnboardingSetupScreen />);

    await drainTimers();
    expect(screen.getByText('Home limit reached')).toBeTruthy();
    expect(screen.getByText(t('onBoarding.setupFailedTitle'))).toBeTruthy();

    await user.press(screen.getByText(t('labels.tryAgain')));
    await drainTimers();
    expect(mockRun).toHaveBeenCalledTimes(2);
    await drainTimers();
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('OnboardingSetup');
  });

  it('continues past a refusal when asked', async () => {
    const user = userEvent.setup();
    mockRun.mockResolvedValueOnce({ status: 'failed', message: 'Refused' });
    render(<OnboardingSetupScreen />);

    await drainTimers();
    await user.press(screen.getByText(t('labels.continue')));
    expect(mockNavigateToNextStep).toHaveBeenCalledWith('OnboardingSetup');
    expect(mockRun).toHaveBeenCalledTimes(1);
  });
});
