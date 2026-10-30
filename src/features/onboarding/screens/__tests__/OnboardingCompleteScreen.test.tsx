'use no memo';

import React from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import type { AlertButton } from '#platform/presenters';
import { OnboardingCompleteScreen } from '../OnboardingCompleteScreen';
import {
  useOnboardingSummary,
  type OnboardingSummary,
} from '#features/onboarding/hooks/useOnboardingSummary';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

const mockUpdateUser = jest.fn();
jest.mock('#store/useAppStore', () => ({
  useUser: () => ({ id: 'u1', onBoarded: false }),
  useUpdateUser: () => mockUpdateUser,
  useSelectedHomeId: () => 'home-1',
}));

jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#features/onboarding/hooks/useOnboardingSummary');

const mockCompleteOnboarding = jest.fn();
jest.mock('#features/onboarding/hooks/useCompleteOnboarding', () => ({
  useCompleteOnboarding: () => ({ completeOnboarding: mockCompleteOnboarding }),
}));

let mockPayoff: unknown[] = [];
let mockShowCheckLabel = false;
jest.mock('#features/onboarding/hooks/useRecipePayoff', () => ({
  useRecipePayoff: () => ({
    rows: mockPayoff,
    showCheckLabel: mockShowCheckLabel,
  }),
}));

const mockInviteLink = jest.fn();
jest.mock('#features/onboarding/hooks/useHouseholdInvite', () => ({
  useHouseholdInvite: () => ({ inviteLink: mockInviteLink }),
}));

let mockVerified = true;
jest.mock('#hooks/auth/useEmailVerification', () => ({
  useVerifiedEmailGate: () => ({
    requireVerifiedEmail: () => mockVerified,
    hasUnverifiedEmail: !mockVerified,
  }),
}));

const mockShareUrl = jest.fn();
jest.mock('#native/share', () => ({
  shareUrl: (...args: unknown[]) => mockShareUrl(...args),
}));

let mockPushEnabled = false;
jest.mock('#features/notifications/hooks/useNotificationSettings', () => ({
  useNotificationSettings: () => ({
    settings: { pushEnabled: mockPushEnabled },
    updateMultipleSettings: jest.fn(),
  }),
}));

let mockHasPermission: boolean | null = false;
const mockTurnOnPush = jest.fn();
jest.mock('#features/notifications/screens/useTurnOnPush', () => ({
  useTurnOnPush: () => ({
    hasPermission: mockHasPermission,
    checkPermissions: jest.fn(),
    turnOnPush: mockTurnOnPush,
  }),
}));

jest.mock('#features/onboarding/components/OnBoardingWrapper', () => ({
  OnBoardingWrapper: ({
    title,
    subtitle,
    children,
    primaryAction,
    testID,
  }: {
    title?: string;
    subtitle?: string;
    children?: React.ReactNode;
    primaryAction?: React.ReactNode;
    testID?: string;
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
        {children}
        {primaryAction}
      </View>
    );
  },
}));

const summaryOf = (done: Partial<OnboardingSummary>): void => {
  jest.mocked(useOnboardingSummary).mockReturnValue({
    homeAndPantry: false,
    shoppingList: false,
    cooksFor: null,
    dietarySaved: false,
    receiptItems: 0,
    stapleItems: 0,
    ...done,
  });
};

const HOME_READY = { homeAndPantry: true, shoppingList: true };

const SHAKSHUKA = {
  source: 'suggestion',
  edge: {
    coverage: 80,
    expiringStacks: [],
    node: {
      id: 'r1',
      name: 'Shakshuka',
      imageUrl: null,
      servings: 2,
      totalTimeMinutes: 25,
    },
  },
};

/** The summary's lines in order, read off their bullets. */
const summaryLines = () =>
  screen.getAllByText(/^• /).map(node => String(node.props.children).slice(2));

let alertButtons: AlertButton[] = [];

/** "Get started", then the notification dialog's button with this text. */
async function getStarted(
  user: ReturnType<typeof userEvent.setup>,
  answer?: string,
) {
  await user.press(screen.getByText(t('labels.getStarted')));
  if (!answer) return;
  const button = alertButtons.find(candidate => candidate.text === answer);
  button?.onPress?.();
}

beforeEach(() => {
  jest.clearAllMocks();
  summaryOf(HOME_READY);
  mockPayoff = [];
  mockShowCheckLabel = false;
  mockVerified = true;
  mockPushEnabled = false;
  mockHasPermission = false;
  mockCompleteOnboarding.mockResolvedValue(true);
  mockTurnOnPush.mockResolvedValue(true);
  mockInviteLink.mockResolvedValue('https://app.souschef.dev/join-home/ABC123');
  alertButtons = [];
  jest
    .spyOn(alertService, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      alertButtons = buttons ?? [];
    });
});

afterEach(() => jest.restoreAllMocks());

describe('OnboardingCompleteScreen', () => {
  describe('the summary', () => {
    it('lists every step done, after saying the home is ready', () => {
      summaryOf({
        ...HOME_READY,
        cooksFor: 2,
        dietarySaved: true,
        receiptItems: 7,
      });
      render(<OnboardingCompleteScreen />);

      expect(summaryLines()).toEqual([
        t('onBoarding.summaryHomeReady'),
        t('onBoarding.summaryCooksFor', { count: 2 }),
        t('onBoarding.summaryDietarySaved'),
        t('onBoarding.summaryReceiptItems', { count: 7 }),
      ]);
    });

    it('leaves out a skipped dietary step', () => {
      summaryOf({ ...HOME_READY, cooksFor: 1, receiptItems: 3 });
      render(<OnboardingCompleteScreen />);

      expect(summaryLines()).toEqual([
        t('onBoarding.summaryHomeReady'),
        t('onBoarding.summaryCooksFor', { count: 1 }),
        t('onBoarding.summaryReceiptItems', { count: 3 }),
      ]);
    });

    it('names staples picked instead of a receipt', () => {
      summaryOf({ ...HOME_READY, stapleItems: 12 });
      render(<OnboardingCompleteScreen />);

      expect(summaryLines()).toEqual([
        t('onBoarding.summaryHomeReady'),
        t('onBoarding.summaryStapleItems', { count: 12 }),
      ]);
    });

    it('says only that the home is ready when every step was skipped', () => {
      render(<OnboardingCompleteScreen />);

      expect(summaryLines()).toEqual([t('onBoarding.summaryHomeReady')]);
      expect(screen.getByText(t('onBoarding.completeSubtitle'))).toBeTruthy();
    });

    it('with nothing set up, says so and lists nothing', () => {
      summaryOf({});
      render(<OnboardingCompleteScreen />);

      expect(screen.getByText(t('onBoarding.readyToStart'))).toBeTruthy();
      expect(screen.getByText(t('onBoarding.nothingSetUp'))).toBeTruthy();
      expect(screen.queryByText(t('onBoarding.congratulations'))).toBeNull();
      expect(screen.queryAllByText(/^• /)).toHaveLength(0);
    });
  });

  describe('the recipes the pantry can make', () => {
    it('shows none with nothing added', () => {
      render(<OnboardingCompleteScreen />);

      expect(screen.queryByTestId(onboardingTestIDs.payoff)).toBeNull();
    });

    it('shows the pantry recipes', () => {
      mockPayoff = [SHAKSHUKA];
      render(<OnboardingCompleteScreen />);

      expect(screen.getByTestId(onboardingTestIDs.payoff)).toBeTruthy();
      expect(screen.getByText(t('recipes.basedOnPantry'))).toBeTruthy();
      expect(screen.getByText('Shakshuka')).toBeTruthy();
      expect(screen.queryByText(t('dietaryAlerts.checkLabel'))).toBeNull();
    });

    it('says to check the label under them when a restriction applies', () => {
      mockPayoff = [SHAKSHUKA];
      mockShowCheckLabel = true;
      render(<OnboardingCompleteScreen />);

      expect(
        within(screen.getByTestId(onboardingTestIDs.payoff)).getByText(
          t('dietaryAlerts.checkLabel'),
        ),
      ).toBeTruthy();
    });

    it('shows no caveat on its own when there is no recipe', () => {
      mockShowCheckLabel = true;
      render(<OnboardingCompleteScreen />);

      expect(screen.queryByText(t('dietaryAlerts.checkLabel'))).toBeNull();
    });
  });

  describe('the invite link', () => {
    it('shares the home\'s link for "two of us"', async () => {
      summaryOf({ ...HOME_READY, cooksFor: 2 });
      const user = userEvent.setup();
      render(<OnboardingCompleteScreen />);

      await user.press(screen.getByText(t('onBoarding.inviteHousehold')));

      await waitFor(() =>
        expect(mockShareUrl).toHaveBeenCalledWith(
          'https://app.souschef.dev/join-home/ABC123',
          t('homeDetail.shareLinkMessage'),
        ),
      );
    });

    it('offers no invite for "just me"', () => {
      summaryOf({ ...HOME_READY, cooksFor: 1 });
      render(<OnboardingCompleteScreen />);

      expect(screen.queryByTestId(onboardingTestIDs.invite)).toBeNull();
    });

    it('stops at the email gate for an unverified account', async () => {
      summaryOf({ ...HOME_READY, cooksFor: 3 });
      mockVerified = false;
      const user = userEvent.setup();
      render(<OnboardingCompleteScreen />);

      await user.press(screen.getByText(t('onBoarding.inviteHousehold')));

      expect(mockInviteLink).not.toHaveBeenCalled();
      expect(mockShareUrl).not.toHaveBeenCalled();
    });

    it('says so when no link could be made, and finishing still works', async () => {
      summaryOf({ ...HOME_READY, cooksFor: 2 });
      mockInviteLink.mockResolvedValue(null);
      const user = userEvent.setup();
      render(<OnboardingCompleteScreen />);

      await user.press(screen.getByText(t('onBoarding.inviteHousehold')));
      expect(
        await screen.findByText(t('onBoarding.inviteFailed')),
      ).toBeTruthy();
      await getStarted(user, t('labels.notNow'));

      await waitFor(() =>
        expect(mockUpdateUser).toHaveBeenCalledWith({ onBoarded: true }),
      );
    });
  });

  describe('the notification ask', () => {
    it('turns push and expiry alerts on when the user agrees, then finishes', async () => {
      const user = userEvent.setup();
      render(<OnboardingCompleteScreen />);

      await getStarted(user, t('onBoarding.notifyTurnOn'));

      await waitFor(() =>
        expect(mockUpdateUser).toHaveBeenCalledWith({ onBoarded: true }),
      );
      expect(mockTurnOnPush).toHaveBeenCalledWith({
        expirationNotifications: true,
      });
    });

    it('finishes with nothing turned on when the user says not now', async () => {
      const user = userEvent.setup();
      render(<OnboardingCompleteScreen />);

      await getStarted(user, t('labels.notNow'));

      await waitFor(() =>
        expect(mockUpdateUser).toHaveBeenCalledWith({ onBoarded: true }),
      );
      expect(mockTurnOnPush).not.toHaveBeenCalled();
    });

    it('does not ask when the device allows and push is on', async () => {
      mockHasPermission = true;
      mockPushEnabled = true;
      const user = userEvent.setup();
      render(<OnboardingCompleteScreen />);

      await getStarted(user);

      expect(alertService.alert).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(mockUpdateUser).toHaveBeenCalledWith({ onBoarded: true }),
      );
    });

    it('asks when the device allows but push is off', async () => {
      mockHasPermission = true;
      const user = userEvent.setup();
      render(<OnboardingCompleteScreen />);

      await getStarted(user);

      expect(alertService.alert).toHaveBeenCalledWith(
        t('onBoarding.notifyTitle'),
        t('onBoarding.notifyMessage'),
        expect.any(Array),
      );
    });
  });

  it('stays and says so when completing fails', async () => {
    mockCompleteOnboarding.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<OnboardingCompleteScreen />);

    await getStarted(user, t('labels.notNow'));

    expect(
      await screen.findByText(t('onBoarding.completeOnboardingError')),
    ).toBeTruthy();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
