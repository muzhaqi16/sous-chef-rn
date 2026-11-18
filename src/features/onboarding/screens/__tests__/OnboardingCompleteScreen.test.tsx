import React from 'react';
import {
  act,
  fireEvent,
  renderHook,
  screen,
} from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import { withTiming } from 'react-native-reanimated';
import { t } from '#/i18n';
import { makeCache } from '#/apollo/cache';
import { requirePlatform } from '#/platform/install';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import {
  ErrorCode,
  ErrorDisposition,
  UsualStoreSource,
} from '#/graphql/generated/schemaTypes';
import { CompleteOnboardingDocument } from '#operations/auth/user.generated';
import { EnableHomeJoinLinkDocument } from '#operations/home/home.generated';
import {
  GetDietaryProfileDocument,
  UpdateDietaryProfileDocument,
} from '#operations/user/user.generated';
import {
  writeUsualStores,
  type UsualStoreEntry,
} from '#features/catalog/cache/usualStores';
import { UsualStoresDocument } from '#features/catalog/hooks/useUsualStores.generated';
import { deviceRegion } from '#/domain/regionCurrency';
import { shareUrl } from '#native/share';
import {
  initialOnboardingProgress,
  useOnboardingProgressStore,
} from '#features/onboarding/store/onboardingProgressStore';
import {
  startTutorialSession,
  useTutorialSession,
} from '#hooks/ui/tutorialSession';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { isRecord } from '#/utils/isRecord';
import { OnboardingCompleteScreen } from '../OnboardingCompleteScreen';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#native/share');
jest.mock('#/domain/regionCurrency', () => ({
  ...jest.requireActual('#/domain/regionCurrency'),
  deviceRegion: jest.fn(),
}));
jest.mock('#features/onboarding/components/OnboardingStepScaffold', () =>
  require('#/test-utils/onboardingStepScaffold'),
);

const ME = 'u1';
const HOME = 'home-1';
const LINK = 'https://app.souschef.dev/join-home/ABC123';

let log = operationLog();

type Profile = NonNullable<
  NonNullable<
    MockDataFor<typeof GetDietaryProfileDocument>['me']
  >['dietaryProfile']
>;

const profileOf = (cooksFor: number | null): Profile => ({
  __typename: 'DietaryProfile',
  id: 'profile-1',
  userId: ME,
  cooksFor,
  restrictions: [],
});

const usualStore = (
  id: string,
  name: string,
  addedVia = UsualStoreSource.Picked,
): UsualStoreEntry => ({
  __typename: 'UsualStore',
  id: `${HOME}:${id}`,
  addedVia,
  pinned: false,
  compared: addedVia === UsualStoreSource.Receipt,
  lastUsedAt:
    addedVia === UsualStoreSource.Receipt ? '2026-11-01T12:00:00.000Z' : null,
  store: { __typename: 'Store', id, name, address: null, chain: null },
  chain: null,
});

const completed = (held = false) =>
  recordMock(CompleteOnboardingDocument, {
    held,
    data: {
      completeOnboarding: {
        __typename: 'CompleteOnboardingPayload',
        user: { __typename: 'User', id: ME, onBoarded: true },
      },
    },
  });

const completionRefused = () =>
  recordMock(CompleteOnboardingDocument, {
    data: {
      completeOnboarding: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        disposition: ErrorDisposition.Fail,
        message: 'Onboarding could not be completed.',
        field: null,
      },
    },
  });

const linkEnabled = () =>
  recordMock(EnableHomeJoinLinkDocument, {
    maxUsageCount: 1,
    data: {
      enableHomeJoinLink: {
        __typename: 'UpdateHomePayload',
        home: {
          __typename: 'Home',
          id: HOME,
          joinCode: 'ABC123',
          joinLink: { __typename: 'ShareLink', universal: LINK },
        },
      },
    },
  });

const linkRefused = () =>
  recordMock(EnableHomeJoinLinkDocument, {
    maxUsageCount: 1,
    data: {
      enableHomeJoinLink: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        disposition: ErrorDisposition.Fail,
        message: 'No link.',
        field: null,
      },
    },
  });

/** Saves the household size the write sends, as the API does. */
const householdSaved = () =>
  recordMock(UpdateDietaryProfileDocument, {
    dataFor: (variables): MockDataFor<typeof UpdateDietaryProfileDocument> => {
      const input = isRecord(variables.input) ? variables.input : {};
      return {
        updateDietaryProfile: {
          __typename: 'UpdateDietaryProfilePayload',
          dietaryProfile: profileOf(
            typeof input.cooksFor === 'number' ? input.cooksFor : null,
          ),
        },
      };
    },
  });

interface Visit {
  /** The steps answered on the way here. */
  done?: Partial<typeof initialOnboardingProgress>;
  /** A home and pantry, and a shopping list, made at sign-up. */
  homeAndPantry?: boolean;
  shoppingList?: boolean;
  firstName?: string;
  emailVerified?: boolean;
  signedIn?: boolean;
  stores?: UsualStoreEntry[];
  answers?: ReturnType<typeof recordMock>[];
}

/** The screen at the end of onboarding, over the household's state. */
async function arrive({
  done = {},
  homeAndPantry = true,
  shoppingList = true,
  firstName,
  emailVerified = true,
  signedIn = true,
  stores = [],
  answers = [],
}: Visit = {}) {
  useStore.setState({
    user: signedIn
      ? {
          id: ME,
          email: 'cook@example.com',
          emailVerified,
          onBoarded: false,
          ...(firstName ? { firstName } : {}),
        }
      : null,
    selectedHomeId: homeAndPantry ? HOME : null,
    selectedPantryId: homeAndPantry ? 'pantry-1' : null,
    selectedShoppingListId: shoppingList ? 'list-1' : null,
  });
  useOnboardingProgressStore.setState({
    ...initialOnboardingProgress,
    ...done,
  });
  const cache = makeCache();
  writeUsualStores(cache, HOME, stores);
  const { client } = renderWithApollo(<OnboardingCompleteScreen />, {
    cache,
    links: [log.link],
    operationMocks: [
      ...answers.map(answer => answer.mock),
      recordMock(GetDietaryProfileDocument, {
        data: {
          me: {
            __typename: 'User',
            id: ME,
            dietaryProfile: profileOf(done.cooksFor ?? null),
          },
        },
      }).mock,
    ],
  });
  // Offline, the profile is read from the cache alone.
  if (signedIn && !isApiUnavailable(useStore.getState())) {
    await log.landed(GetDietaryProfileDocument);
  }
  return { cache, client };
}

/** The summary's lines in order, read off their bullets. */
const summaryLines = () =>
  screen.getAllByText(/^• /).map(node => String(node.props.children).slice(2));

const getStarted = () =>
  fireEvent.press(screen.getByText(t('labels.getStarted')));

const invite = () =>
  fireEvent.press(screen.getByText(t('onBoarding.inviteHousehold')));

/** Resolves with what the share sheet was handed, once it is. */
const shared = () =>
  new Promise<Parameters<typeof shareUrl>>(resolve => {
    jest.mocked(shareUrl).mockImplementation(async (...args) => {
      resolve(args);
    });
  });

const navigatedTo = () => jest.mocked(CommonActions.navigate).mock.calls;

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  startTutorialSession();
  jest.mocked(deviceRegion).mockReturnValue('US');
  jest.mocked(shareUrl).mockResolvedValue(undefined);
  useStore.setState({ isOnline: true, apiReachable: null });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('finishing', () => {
  it('marks the user onboarded and lands without asking anything', async () => {
    await arrive({ answers: [completed()] });

    getStarted();
    await act(() => log.landed(CompleteOnboardingDocument));

    expect(useStore.getState().user?.onBoarded).toBe(true);
    expect(
      renderHook(() => useTutorialSession()).result.current.onboardingFinished,
    ).toBe(true);
  });

  it('is busy while completing, so a second press sends nothing', async () => {
    const answer = completed(true);
    await arrive({ answers: [answer] });

    getStarted();
    await act(() => log.requested(CompleteOnboardingDocument));
    getStarted();
    answer.release();
    await act(() => log.landed(CompleteOnboardingDocument));

    expect(answer.fired).toHaveLength(1);
  });

  it('stays and says why when completing is refused', async () => {
    await arrive({ answers: [completionRefused()] });

    getStarted();
    await act(() => log.landed(CompleteOnboardingDocument));

    expect(
      screen.getByText(t('onBoarding.completeOnboardingError')),
    ).toBeTruthy();
    expect(useStore.getState().user?.onBoarded).toBe(false);
  });

  it('without an account, says so and sends nothing', async () => {
    const answer = completed();
    await arrive({ signedIn: false, answers: [answer] });

    getStarted();

    expect(screen.getByText(t('onBoarding.userNotFoundError'))).toBeTruthy();
    expect(answer.fired).toHaveLength(0);
  });
});

describe('the celebration', () => {
  it('greets the user by first name, with a check and one success haptic', async () => {
    const success = jest.spyOn(requirePlatform('haptics'), 'success');
    await arrive({ firstName: 'Nora' });

    expect(
      screen.getByText(t('onBoarding.completeTitleNamed', { name: 'Nora' })),
    ).toBeTruthy();
    expect(screen.getByTestId(onboardingTestIDs.completionCheck)).toBeTruthy();
    expect(success).toHaveBeenCalledTimes(1);
  });

  it('greets without a name when the account has none', async () => {
    await arrive();

    expect(screen.getByText(t('onBoarding.completeTitle'))).toBeTruthy();
  });

  // Reanimated finishes an animation at once under the OS setting when the
  // call passes no override. Verified: #reanimated-applies-reduce-motion-itself
  it('leaves Reduce Motion to the device, so the check shows complete', async () => {
    await arrive();

    expect(withTiming).toHaveBeenCalled();
    for (const [, config] of jest.mocked(withTiming).mock.calls) {
      expect(config).not.toHaveProperty('reduceMotion');
    }
  });
});

describe('the summary', () => {
  it('lists every step done, after saying the home is ready', async () => {
    await arrive({
      done: { cooksFor: 2, dietarySaved: true, receiptItems: 7 },
    });

    expect(summaryLines()).toEqual([
      t('onBoarding.summaryHomeReady'),
      t('onBoarding.summaryCooksFor', { count: 2 }),
      t('onBoarding.summaryDietarySaved'),
      t('onBoarding.summaryReceiptItems', { count: 7 }),
    ]);
    expect(screen.getByText(t('onBoarding.completeSubtitle'))).toBeTruthy();
  });

  it.each([
    {
      made: 'a home and pantry without a list',
      shoppingList: false,
      line: 'onBoarding.summaryHomeAndPantry',
    },
    {
      made: 'a list without a home',
      homeAndPantry: false,
      line: 'onBoarding.summaryShoppingList',
    },
  ] as const)('says so for $made', async ({ line, ...made }) => {
    await arrive(made);

    expect(summaryLines()).toEqual([t(line)]);
  });

  it('leaves out a skipped dietary step and a receipt with nothing added', async () => {
    await arrive({ done: { cooksFor: 1, receiptItems: 0 } });

    expect(summaryLines()).toEqual([
      t('onBoarding.summaryHomeReady'),
      t('onBoarding.summaryCooksFor', { count: 1 }),
    ]);
  });

  it('names staples picked instead of a receipt', async () => {
    await arrive({ done: { stapleItems: 12 } });

    expect(summaryLines()).toEqual([
      t('onBoarding.summaryHomeReady'),
      t('onBoarding.summaryStapleItems', { count: 12 }),
    ]);
  });

  it('with nothing set up, says so and lists nothing', async () => {
    await arrive({ homeAndPantry: false, shoppingList: false });

    expect(screen.getByText(t('onBoarding.readyToStart'))).toBeTruthy();
    expect(screen.getByText(t('onBoarding.nothingSetUp'))).toBeTruthy();
    expect(screen.queryByText(t('onBoarding.summaryLead'))).toBeNull();
    expect(screen.queryAllByText(/^• /)).toHaveLength(0);
  });

  // The pantry's recipes are on Today, one tap away, so the offers stay
  // above the fold here.
  it('shows no recipes, even with staples added', async () => {
    await arrive({ done: { stapleItems: 3 } });

    expect(screen.queryByText(t('recipes.basedOnPantry'))).toBeNull();
  });
});

describe('changing an answer from the summary', () => {
  it('saves each step of the stepper, from the last one', async () => {
    const saved = householdSaved();
    await arrive({ done: { cooksFor: 4 }, answers: [saved] });

    fireEvent.press(
      screen.getByTestId(onboardingTestIDs.summaryLine('household')),
    );
    // Two taps before the first save lands: the second steps from the first.
    fireEvent.press(screen.getByTestId(onboardingTestIDs.householdFewer));
    fireEvent.press(screen.getByTestId(onboardingTestIDs.householdFewer));
    await act(() => log.landed(UpdateDietaryProfileDocument, 2));

    expect(
      saved.fired.map(variables =>
        isRecord(variables.input) ? variables.input.cooksFor : undefined,
      ),
    ).toEqual([3, 2]);
    expect(summaryLines()).toContain(
      t('onBoarding.summaryCooksFor', { count: 2 }),
    );
    expect(useOnboardingProgressStore.getState().cooksFor).toBe(2);
  });

  it('opens the dietary step, which returns here once saved', async () => {
    await arrive({ done: { dietarySaved: true } });

    fireEvent.press(
      screen.getByTestId(onboardingTestIDs.summaryLine('dietary')),
    );

    expect(useAppNavigation().navigation.dispatch).toHaveBeenCalled();
    expect(navigatedTo()).toEqual([
      ['Dietary', { returnTo: 'OnboardingComplete' }],
    ]);
  });

  it('leaves the home and kitchen lines as they are', async () => {
    await arrive({ done: { stapleItems: 3 } });

    expect(
      screen.queryByTestId(onboardingTestIDs.summaryLine('home')),
    ).toBeNull();
    expect(
      screen.queryByTestId(onboardingTestIDs.summaryLine('staples')),
    ).toBeNull();
  });
});

describe('the invite link', () => {
  it('shares the home\'s link for "two of us"', async () => {
    await arrive({ done: { cooksFor: 2 }, answers: [linkEnabled()] });
    const sheet = shared();

    invite();

    await expect(sheet).resolves.toEqual([
      LINK,
      t('homeDetail.shareLinkMessage'),
    ]);
  });

  it('offers no invite for "just me"', async () => {
    await arrive({ done: { cooksFor: 1 } });

    expect(screen.queryByTestId(onboardingTestIDs.invite)).toBeNull();
  });

  it('stops at the email gate for an unverified account', async () => {
    const answer = linkEnabled();
    await arrive({
      done: { cooksFor: 3 },
      emailVerified: false,
      answers: [answer],
    });

    invite();

    expect(answer.fired).toHaveLength(0);
    expect(shareUrl).not.toHaveBeenCalled();
  });

  it('says so when no link could be made, and finishing still works', async () => {
    await arrive({
      done: { cooksFor: 2 },
      answers: [linkRefused(), completed()],
    });

    invite();
    await act(() => log.landed(EnableHomeJoinLinkDocument));
    expect(screen.getByText(t('onBoarding.inviteFailed'))).toBeTruthy();
    getStarted();
    await act(() => log.landed(CompleteOnboardingDocument));

    expect(useStore.getState().user?.onBoarded).toBe(true);
  });

  it('clears the failure once a retry shares the link', async () => {
    await arrive({
      done: { cooksFor: 2 },
      answers: [linkRefused(), linkEnabled()],
    });
    invite();
    await act(() => log.landed(EnableHomeJoinLinkDocument));
    const sheet = shared();

    invite();
    await act(() => sheet);

    expect(screen.queryByText(t('onBoarding.inviteFailed'))).toBeNull();
  });
});

describe('the store card', () => {
  const offer = () => screen.queryByText(t('onBoarding.addStores'));

  it('finishes without it, showing no zip code, location prompt or store list', async () => {
    await arrive({ answers: [completed()] });
    expect(offer()).toBeTruthy();

    getStarted();
    await act(() => log.landed(CompleteOnboardingDocument));

    expect(useStore.getState().user?.onBoarded).toBe(true);
    expect(navigatedTo()).toEqual([]);
    expect(screen.queryByText(t('storePicker.zipLabel'))).toBeNull();
    expect(screen.queryByText(t('storePicker.nearMe'))).toBeNull();
    expect(screen.queryByText(t('storePicker.nearMeTitle'))).toBeNull();
  });

  it("opens the store picker for the user's home, asking nothing of the device", async () => {
    const location = requirePlatform('approximateLocation');
    const access = jest.spyOn(location, 'access');
    const requestAccess = jest.spyOn(location, 'requestAccess');
    await arrive();

    fireEvent.press(screen.getByText(t('onBoarding.addStores')));

    expect(navigatedTo()).toEqual([['OnboardingStores', { homeId: HOME }]]);
    expect(access).not.toHaveBeenCalled();
    expect(requestAccess).not.toHaveBeenCalled();
  });

  it('is not offered without a home', async () => {
    await arrive({ homeAndPantry: false });

    expect(screen.queryByTestId(onboardingTestIDs.stores)).toBeNull();
  });

  it('is offered whatever the device region', async () => {
    jest.mocked(deviceRegion).mockReturnValue('IT');
    await arrive();

    expect(offer()).toBeTruthy();
  });

  it('is not offered while the API is unavailable, and the rest stays', async () => {
    useStore.setState({ isOnline: false });
    await arrive();

    expect(screen.queryByTestId(onboardingTestIDs.stores)).toBeNull();
    expect(summaryLines()).toEqual([t('onBoarding.summaryHomeReady')]);
    expect(screen.getByText(t('labels.getStarted'))).toBeTruthy();
  });

  it('names the stores picked from it, once back, and offers to add more', async () => {
    const { cache, client } = await arrive();
    expect(offer()).toBeTruthy();
    // The card's watcher hears a write in the same broadcast as this one.
    const broadcast = new Promise<void>(resolve => {
      client
        .watchQuery({
          query: UsualStoresDocument,
          variables: { homeId: HOME },
          fetchPolicy: 'cache-only',
        })
        .subscribe(({ data }) => {
          if (data?.usualStores?.length === 2) resolve();
        });
    });

    writeUsualStores(cache, HOME, [
      usualStore('s-aldi', 'ALDI'),
      usualStore('s-sal', 'Save-A-Lot'),
    ]);
    await act(() => broadcast);

    expect(
      screen.getByText(
        t('onBoarding.yourStores', { names: 'ALDI, Save-A-Lot' }),
      ),
    ).toBeTruthy();
    expect(offer()).toBeNull();
    expect(screen.getByText(t('onBoarding.addMoreStores'))).toBeTruthy();
  });

  it("counts a scanned receipt's store among them", async () => {
    await arrive({
      stores: [
        usualStore('s-ge', 'Giant Eagle', UsualStoreSource.Receipt),
        usualStore('s-aldi', 'ALDI'),
      ],
    });

    expect(
      screen.getByText(
        t('onBoarding.yourStores', { names: 'Giant Eagle, ALDI' }),
      ),
    ).toBeTruthy();
  });

  it('names three, then counts the rest', async () => {
    await arrive({
      stores: [
        usualStore('s-ge', 'Giant Eagle', UsualStoreSource.Receipt),
        usualStore('s-aldi', 'ALDI'),
        usualStore('s-sal', 'Save-A-Lot'),
        usualStore('s-coop', 'East End Food Co-op'),
        usualStore('s-tj', "Trader Joe's"),
      ],
    });

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
