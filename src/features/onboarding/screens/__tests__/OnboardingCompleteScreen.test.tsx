'use no memo';

import React from 'react';
import { act, screen, userEvent, within } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import { t } from '#/i18n';
import { makeCache } from '#/apollo/cache';
import { withTiming } from 'react-native-reanimated';
import { requirePlatform } from '#/platform/install';
import { useStore } from '#store';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { UsualStoreSource } from '#/graphql/generated/schemaTypes';
import { UsualStoresDocument } from '#features/catalog/hooks/useUsualStores.generated';
import {
  writeUsualStores,
  type UsualStoreEntry,
} from '#features/catalog/cache/usualStores';
import { alertService } from '#/services/alertService';
import type { AlertButton } from '#platform/presenters';
import { OnboardingCompleteScreen } from '../OnboardingCompleteScreen';
import {
  useOnboardingSummary,
  type OnboardingSummary,
} from '#features/onboarding/hooks/useOnboardingSummary';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { drainTimers } from '#/test-utils/drainTimers';

const mockUpdateUser = jest.fn();
let mockHomeId: string | null = 'home-1';
let mockUser: { id: string; onBoarded: boolean; firstName?: string } = {
  id: 'u1',
  onBoarded: false,
};
jest.mock('#store/useAppStore', () => ({
  ...jest.requireActual('#store/useAppStore'),
  useUser: () => mockUser,
  useUpdateUser: () => mockUpdateUser,
  useSelectedHomeId: () => mockHomeId,
}));

let mockRegion: string | null = 'US';
jest.mock('#/domain/regionCurrency', () => ({
  ...jest.requireActual('#/domain/regionCurrency'),
  deviceRegion: () => mockRegion,
}));

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#features/onboarding/hooks/useOnboardingSummary');
const mockAnswerHousehold = jest.fn().mockResolvedValue(undefined);
jest.mock('#features/onboarding/hooks/useHouseholdAnswer', () => ({
  useHouseholdAnswer: () => ({ answer: mockAnswerHousehold, saved: null }),
}));

const mockCompleteOnboarding = jest.fn();
jest.mock('#features/onboarding/hooks/useCompleteOnboarding', () => ({
  useCompleteOnboarding: () => ({ completeOnboarding: mockCompleteOnboarding }),
}));

let mockPayoff: unknown[] = [];
let mockShowCheckLabel = false;
let mockPopular = false;
jest.mock('#features/onboarding/hooks/useRecipePayoff', () => ({
  useRecipePayoff: () => ({
    rows: mockPayoff,
    popular: mockPopular,
    showCheckLabel: mockShowCheckLabel,
  }),
}));
const mockAddMissing = jest.fn().mockResolvedValue(true);
jest.mock('#features/recipes/hooks/useAddMissingToList', () => ({
  useAddMissingToList: () => mockAddMissing,
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

jest.mock('#features/onboarding/components/OnboardingStepScaffold', () =>
  require('#/test-utils/onboardingStepScaffold'),
);

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
    missingIngredientCount: 1,
    usedIngredients: [{ id: 'r1-eggs', name: 'eggs', item: null }],
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

/** Uses the eggs held, under half of it: three more to buy. */
const FRITTATA = {
  source: 'suggestion',
  edge: {
    coverage: 30,
    missingIngredientCount: 3,
    usedIngredients: [{ id: 'r2-eggs', name: 'eggs', item: null }],
    missingIngredients: ['spinach', 'feta', 'milk'].map(name => ({
      id: `r2-${name}`,
      name,
      quantity: 1,
      isOptional: false,
      unit: null,
      item: null,
    })),
    expiringStacks: [],
    node: {
      id: 'r2',
      name: 'Frittata',
      imageUrl: null,
      servings: 2,
      totalTimeMinutes: 20,
    },
  },
};

const usualStore = (
  id: string,
  name: string,
  addedVia = UsualStoreSource.Picked,
): UsualStoreEntry => ({
  __typename: 'UsualStore',
  id: `home-1:${id}`,
  addedVia,
  pinned: false,
  compared: addedVia === UsualStoreSource.Receipt,
  lastUsedAt:
    addedVia === UsualStoreSource.Receipt ? '2026-11-01T12:00:00.000Z' : null,
  store: { __typename: 'Store', id, name, address: null, chain: null },
  chain: null,
});

/** The screen over a cache holding the household's usual stores. */
const renderScreen = (stores: UsualStoreEntry[] = []) => {
  const cache = makeCache();
  writeUsualStores(cache, 'home-1', stores);
  const { client } = renderWithApollo(<OnboardingCompleteScreen />, {
    cache,
    operationMocks: [],
  });
  return { cache, client };
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
  mockUser = { id: 'u1', onBoarded: false };
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockHomeId = 'home-1';
  mockRegion = 'US';
  summaryOf(HOME_READY);
  mockPayoff = [];
  mockPopular = false;
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

afterEach(() => {
  jest.restoreAllMocks();
  useStore.setState({ isOnline: true, apiReachable: null });
});

describe('OnboardingCompleteScreen', () => {
  describe('the payoff tiers', () => {
    it('shows an almost-there recipe with what is left to buy, never as ready', () => {
      mockPayoff = [FRITTATA];
      renderScreen();

      expect(
        screen.getByText(
          new RegExp(
            t('recipes.usesYourMoreToBuy', { item: 'eggs', count: 3 }),
          ),
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText(new RegExp(t('recipes.readyToCook'))),
      ).toBeNull();
    });

    it('adds what is missing to the list in one tap', async () => {
      mockPayoff = [FRITTATA];
      const user = userEvent.setup();
      renderScreen();

      await user.press(
        screen.getByTestId(onboardingTestIDs.payoffAddMissing('r2')),
      );
      await act(async () => {
        await mockAddMissing.mock.results[0]?.value;
      });

      expect(mockAddMissing).toHaveBeenCalledWith(
        'r2',
        expect.arrayContaining([expect.objectContaining({ name: 'spinach' })]),
      );
      expect(screen.getByText(t('labels.added'))).toBeTruthy();
    });

    it('titles popular picks from the answers, with no tier', () => {
      mockPopular = true;
      mockPayoff = [
        {
          ...FRITTATA,
          edge: { ...FRITTATA.edge, coverage: 0, usedIngredients: [] },
        },
      ];
      summaryOf({ ...HOME_READY, cooksFor: 4, stapleItems: 3 });
      renderScreen();

      expect(
        screen.getByText(t('onBoarding.payoffPopularTitle', { count: 4 })),
      ).toBeTruthy();
      expect(screen.queryByText(t('recipes.basedOnPantry'))).toBeNull();
      expect(
        screen.queryByTestId(onboardingTestIDs.payoffAddMissing('r2')),
      ).toBeNull();
    });
  });

  describe('tapping a payoff recipe', () => {
    beforeEach(() => {
      useStore.setState({ pendingDeepLinkAction: null });
    });

    it('finishes onboarding and opens the recipe once the app shows', async () => {
      mockPayoff = [SHAKSHUKA];
      const user = userEvent.setup();
      renderScreen();

      await user.press(screen.getByText('Shakshuka'));
      await act(async () => {
        await mockCompleteOnboarding.mock.results[0]?.value;
      });

      expect(useStore.getState().pendingDeepLinkAction).toEqual(
        expect.objectContaining({ type: 'open_recipe', recipeId: 'r1' }),
      );
      expect(mockUpdateUser).toHaveBeenCalledWith({ onBoarded: true });
    });

    it('drops the recipe when finishing fails, so it never opens later', async () => {
      mockPayoff = [SHAKSHUKA];
      mockCompleteOnboarding.mockResolvedValue(false);
      const user = userEvent.setup();
      renderScreen();

      await user.press(screen.getByText('Shakshuka'));
      await act(async () => {
        await mockCompleteOnboarding.mock.results[0]?.value;
      });

      expect(useStore.getState().pendingDeepLinkAction).toBeNull();
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });
  });

  describe('changing an answer from the summary', () => {
    it('changes who the meals are for with a stepper, in place', async () => {
      summaryOf({ ...HOME_READY, cooksFor: 4 });
      const user = userEvent.setup();
      renderScreen();

      await user.press(
        screen.getByTestId(onboardingTestIDs.summaryLine('household')),
      );
      await user.press(screen.getByTestId(onboardingTestIDs.householdFewer));

      // Saved where the household step saves it, so recipes start at three.
      expect(mockAnswerHousehold).toHaveBeenCalledWith(3);
    });

    it('opens the dietary step, which returns here once saved', async () => {
      summaryOf({ ...HOME_READY, dietarySaved: true });
      const user = userEvent.setup();
      renderScreen();

      await user.press(
        screen.getByTestId(onboardingTestIDs.summaryLine('dietary')),
      );

      expect(useAppNavigation().navigation.dispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Dietary', { returnTo: 'OnboardingComplete' }),
      );
    });

    it('leaves the home and kitchen lines as they are', () => {
      summaryOf({ ...HOME_READY, stapleItems: 3 });
      renderScreen();

      expect(
        screen.queryByTestId(onboardingTestIDs.summaryLine('home')),
      ).toBeNull();
      expect(
        screen.queryByTestId(onboardingTestIDs.summaryLine('staples')),
      ).toBeNull();
    });
  });

  describe('the celebration', () => {
    it('greets the user by first name, with a check and one success haptic', () => {
      mockUser = { id: 'u1', onBoarded: false, firstName: 'Nora' };
      const success = jest.spyOn(requirePlatform('haptics'), 'success');
      renderScreen();

      expect(
        screen.getByText(t('onBoarding.completeTitleNamed', { name: 'Nora' })),
      ).toBeTruthy();
      expect(
        screen.getByTestId(onboardingTestIDs.completionCheck),
      ).toBeTruthy();
      expect(success).toHaveBeenCalledTimes(1);
      success.mockRestore();
    });

    it('greets without a name when the account has none', () => {
      renderScreen();

      expect(screen.getByText(t('onBoarding.completeTitle'))).toBeTruthy();
    });

    // Reanimated finishes an animation at once under the OS setting when the
    // call passes no override. Verified: #reanimated-applies-reduce-motion-itself
    it('leaves Reduce Motion to the device, so the check shows complete', () => {
      jest.mocked(withTiming).mockClear();
      renderScreen();

      expect(withTiming).toHaveBeenCalled();
      for (const [, config] of jest.mocked(withTiming).mock.calls) {
        expect(config).not.toHaveProperty('reduceMotion');
      }
    });
  });

  describe('the summary', () => {
    it('lists every step done, after saying the home is ready', () => {
      summaryOf({
        ...HOME_READY,
        cooksFor: 2,
        dietarySaved: true,
        receiptItems: 7,
      });
      renderScreen();

      expect(summaryLines()).toEqual([
        t('onBoarding.summaryHomeReady'),
        t('onBoarding.summaryCooksFor', { count: 2 }),
        t('onBoarding.summaryDietarySaved'),
        t('onBoarding.summaryReceiptItems', { count: 7 }),
      ]);
    });

    it('leaves out a skipped dietary step', () => {
      summaryOf({ ...HOME_READY, cooksFor: 1, receiptItems: 3 });
      renderScreen();

      expect(summaryLines()).toEqual([
        t('onBoarding.summaryHomeReady'),
        t('onBoarding.summaryCooksFor', { count: 1 }),
        t('onBoarding.summaryReceiptItems', { count: 3 }),
      ]);
    });

    it('names staples picked instead of a receipt', () => {
      summaryOf({ ...HOME_READY, stapleItems: 12 });
      renderScreen();

      expect(summaryLines()).toEqual([
        t('onBoarding.summaryHomeReady'),
        t('onBoarding.summaryStapleItems', { count: 12 }),
      ]);
    });

    it('says only that the home is ready when every step was skipped', () => {
      renderScreen();

      expect(summaryLines()).toEqual([t('onBoarding.summaryHomeReady')]);
      expect(screen.getByText(t('onBoarding.completeSubtitle'))).toBeTruthy();
    });

    it('with nothing set up, says so and lists nothing', () => {
      summaryOf({});
      renderScreen();

      expect(screen.getByText(t('onBoarding.readyToStart'))).toBeTruthy();
      expect(screen.getByText(t('onBoarding.nothingSetUp'))).toBeTruthy();
      expect(screen.queryByText(t('onBoarding.summaryLead'))).toBeNull();
      expect(screen.queryAllByText(/^• /)).toHaveLength(0);
    });
  });

  describe('the recipes the pantry can make', () => {
    it('shows none with nothing added', () => {
      renderScreen();

      expect(screen.queryByTestId(onboardingTestIDs.payoff)).toBeNull();
    });

    it('shows the pantry recipes', () => {
      mockPayoff = [SHAKSHUKA];
      renderScreen();

      expect(screen.getByTestId(onboardingTestIDs.payoff)).toBeTruthy();
      expect(screen.getByText(t('recipes.basedOnPantry'))).toBeTruthy();
      expect(screen.getByText('Shakshuka')).toBeTruthy();
      expect(screen.queryByText(t('dietaryAlerts.checkLabel'))).toBeNull();
    });

    it('says to check the label under them when a restriction applies', () => {
      mockPayoff = [SHAKSHUKA];
      mockShowCheckLabel = true;
      renderScreen();

      expect(
        within(screen.getByTestId(onboardingTestIDs.payoff)).getByText(
          t('dietaryAlerts.checkLabel'),
        ),
      ).toBeTruthy();
    });

    it('shows no caveat on its own when there is no recipe', () => {
      mockShowCheckLabel = true;
      renderScreen();

      expect(screen.queryByText(t('dietaryAlerts.checkLabel'))).toBeNull();
    });
  });

  describe('the invite link', () => {
    it('shares the home\'s link for "two of us"', async () => {
      summaryOf({ ...HOME_READY, cooksFor: 2 });
      const user = userEvent.setup();
      renderScreen();

      await user.press(screen.getByText(t('onBoarding.inviteHousehold')));

      await drainTimers();
      expect(mockShareUrl).toHaveBeenCalledWith(
        'https://app.souschef.dev/join-home/ABC123',
        t('homeDetail.shareLinkMessage'),
      );
    });

    it('offers no invite for "just me"', () => {
      summaryOf({ ...HOME_READY, cooksFor: 1 });
      renderScreen();

      expect(screen.queryByTestId(onboardingTestIDs.invite)).toBeNull();
    });

    it('stops at the email gate for an unverified account', async () => {
      summaryOf({ ...HOME_READY, cooksFor: 3 });
      mockVerified = false;
      const user = userEvent.setup();
      renderScreen();

      await user.press(screen.getByText(t('onBoarding.inviteHousehold')));

      expect(mockInviteLink).not.toHaveBeenCalled();
      expect(mockShareUrl).not.toHaveBeenCalled();
    });

    it('says so when no link could be made, and finishing still works', async () => {
      summaryOf({ ...HOME_READY, cooksFor: 2 });
      mockInviteLink.mockResolvedValue(null);
      const user = userEvent.setup();
      renderScreen();

      await user.press(screen.getByText(t('onBoarding.inviteHousehold')));
      await drainTimers();
      expect(screen.getByText(t('onBoarding.inviteFailed'))).toBeTruthy();
      await getStarted(user, t('labels.notNow'));

      await drainTimers();
      expect(mockUpdateUser).toHaveBeenCalledWith({ onBoarded: true });
    });
  });

  describe('the store card', () => {
    const offer = () => screen.queryByText(t('onBoarding.addStores'));

    beforeEach(() => {
      jest.useRealTimers();
    });

    it('finishes without it, showing no zip code, location prompt or store list', async () => {
      const user = userEvent.setup();
      renderScreen();

      expect(offer()).toBeTruthy();
      await getStarted(user, t('labels.notNow'));

      await act(async () => {
        await mockCompleteOnboarding.mock.results[0]?.value;
      });
      expect(mockUpdateUser).toHaveBeenCalledWith({ onBoarded: true });
      expect(useAppNavigation().navigation.dispatch).not.toHaveBeenCalled();
      expect(screen.queryByText(t('storePicker.zipLabel'))).toBeNull();
      expect(screen.queryByText(t('storePicker.nearMe'))).toBeNull();
      expect(screen.queryByText(t('storePicker.nearMeTitle'))).toBeNull();
    });

    it("opens the store picker for the user's home, asking nothing of the device", async () => {
      const location = requirePlatform('approximateLocation');
      const access = jest.spyOn(location, 'access');
      const requestAccess = jest.spyOn(location, 'requestAccess');
      const user = userEvent.setup();
      renderScreen();

      await user.press(screen.getByText(t('onBoarding.addStores')));

      expect(useAppNavigation().navigation.dispatch).toHaveBeenCalledWith(
        CommonActions.navigate('OnboardingStores', { homeId: 'home-1' }),
      );
      expect(access).not.toHaveBeenCalled();
      expect(requestAccess).not.toHaveBeenCalled();
    });

    it('is not offered without a home', () => {
      mockHomeId = null;
      renderScreen();

      expect(screen.queryByTestId(onboardingTestIDs.stores)).toBeNull();
    });

    it('is offered whatever the device region', () => {
      mockRegion = 'IT';
      renderScreen();

      expect(offer()).toBeTruthy();
    });

    it('is not offered while the API is unavailable, and the rest stays', () => {
      useStore.setState({ isOnline: false });
      renderScreen();

      expect(screen.queryByTestId(onboardingTestIDs.stores)).toBeNull();
      expect(summaryLines()).toEqual([t('onBoarding.summaryHomeReady')]);
      expect(screen.getByText(t('labels.getStarted'))).toBeTruthy();
    });

    it('names the stores picked from it, once back', async () => {
      const { cache, client } = renderScreen();
      expect(offer()).toBeTruthy();
      // The card's watcher hears a write in the same broadcast as this one.
      const broadcast = new Promise<void>(resolve => {
        client
          .watchQuery({
            query: UsualStoresDocument,
            variables: { homeId: 'home-1' },
            fetchPolicy: 'cache-only',
          })
          .subscribe(({ data }) => {
            if (data?.usualStores?.length === 2) resolve();
          });
      });

      writeUsualStores(cache, 'home-1', [
        usualStore('s-aldi', 'ALDI'),
        usualStore('s-sal', 'Save-A-Lot'),
      ]);

      await act(async () => {
        await broadcast;
      });

      expect(
        screen.getByText(
          t('onBoarding.yourStores', { names: 'ALDI, Save-A-Lot' }),
        ),
      ).toBeTruthy();
      expect(offer()).toBeNull();
      expect(screen.getByText(t('onBoarding.addMoreStores'))).toBeTruthy();
    });

    it("counts a scanned receipt's store among them", () => {
      renderScreen([
        usualStore('s-ge', 'Giant Eagle', UsualStoreSource.Receipt),
        usualStore('s-aldi', 'ALDI'),
      ]);

      expect(
        screen.getByText(
          t('onBoarding.yourStores', { names: 'Giant Eagle, ALDI' }),
        ),
      ).toBeTruthy();
    });

    it('names three, then counts the rest', () => {
      renderScreen([
        usualStore('s-ge', 'Giant Eagle', UsualStoreSource.Receipt),
        usualStore('s-aldi', 'ALDI'),
        usualStore('s-sal', 'Save-A-Lot'),
        usualStore('s-coop', 'East End Food Co-op'),
        usualStore('s-tj', "Trader Joe's"),
      ]);

      expect(
        screen.getByText(
          t('onBoarding.yourStoresAndMore', {
            names: 'Giant Eagle, ALDI, Save-A-Lot',
            count: 2,
          }),
        ),
      ).toBeTruthy();
    });
  });

  describe('the notification ask', () => {
    it('turns push and expiry alerts on when the user agrees, then finishes', async () => {
      const user = userEvent.setup();
      renderScreen();

      await getStarted(user, t('onBoarding.notifyTurnOn'));

      await drainTimers();
      expect(mockUpdateUser).toHaveBeenCalledWith({ onBoarded: true });
      expect(mockTurnOnPush).toHaveBeenCalledWith({
        expirationNotifications: true,
      });
    });

    it('finishes with nothing turned on when the user says not now', async () => {
      const user = userEvent.setup();
      renderScreen();

      await getStarted(user, t('labels.notNow'));

      await drainTimers();
      expect(mockUpdateUser).toHaveBeenCalledWith({ onBoarded: true });
      expect(mockTurnOnPush).not.toHaveBeenCalled();
    });

    it('does not ask when the device allows and push is on', async () => {
      mockHasPermission = true;
      mockPushEnabled = true;
      const user = userEvent.setup();
      renderScreen();

      await getStarted(user);

      expect(alertService.alert).not.toHaveBeenCalled();
      await drainTimers();
      expect(mockUpdateUser).toHaveBeenCalledWith({ onBoarded: true });
    });

    it('asks when the device allows but push is off', async () => {
      mockHasPermission = true;
      const user = userEvent.setup();
      renderScreen();

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
    renderScreen();

    await getStarted(user, t('labels.notNow'));

    await drainTimers();
    expect(
      screen.getByText(t('onBoarding.completeOnboardingError')),
    ).toBeTruthy();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
