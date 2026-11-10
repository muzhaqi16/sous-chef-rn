import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { useStore } from '#store';
import { Telemetry } from '#services/telemetry';
import { emitTutorialEvent } from '#domain/tutorialEvents';
import { suppressFeatureHintsForE2E } from '#hooks/settings/useFeatureHint';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { GettingStartedDocument } from '../useGettingStarted.generated';
import { useGettingStarted } from '../useGettingStarted';

jest.mock('#features/pantry/hooks/usePantryPermissions', () => ({
  usePantryPermissions: jest.fn(),
}));
jest.mock('#hooks/utils/useIsScreenFocused', () => ({
  useIsScreenFocused: () => true,
}));

const NEW = '2026-12-01T10:00:00Z';
const OLD = '2026-01-01T10:00:00Z';

const signIn = (createdAt: string) =>
  act(() => {
    useStore.setState({
      user: {
        id: 'u1',
        email: 'new@example.com',
        emailVerified: true,
        onBoarded: true,
        createdAt,
      },
      selectedHomeId: 'h1',
      gettingStarted: {},
    });
  });

const accountMock = ({
  cooked = 0,
  planned = 0,
}: { cooked?: number; planned?: number } = {}) =>
  recordMock(GettingStartedDocument, {
    data: {
      me: { id: 'u1', cookingStats: { totalRecipesCooked: cooked } },
      mealPlans: {
        edges:
          planned > 0
            ? [
                {
                  node: {
                    id: 'plan-1',
                    mealPlanItemsConnection: { totalCount: planned },
                  },
                },
              ]
            : [],
      },
    },
    maxUsageCount: 5,
  });

const renderCard = (
  pantryItemCount: number | null = 0,
  account = accountMock(),
) => {
  const log = operationLog();
  const rendered = renderHookWithApollo(
    ({ count }: { count: number | null }) =>
      useGettingStarted({ pantryItemCount: count }),
    {
      operationMocks: [account.mock],
      links: [log.link],
      initialProps: { count: pantryItemCount },
    },
  );
  /** The account's read has answered. */
  const answered = () =>
    act(async () => {
      await log.answered(GettingStartedDocument);
    });
  return { ...rendered, answered };
};

const doneOf = (card: ReturnType<typeof useGettingStarted>['card']) =>
  Object.fromEntries((card?.items ?? []).map(item => [item.id, item.done]));

beforeEach(() => {
  jest.mocked(usePantryPermissions).mockReturnValue({
    canAddItems: true,
    canEditItems: true,
    canRemoveItems: true,
    canCreatePantry: true,
    canDeletePantry: true,
  });
});

describe('useGettingStarted', () => {
  it('A new account: the four items in order, with how many are done', async () => {
    signIn(NEW);
    const { result, answered } = renderCard();

    await answered();
    expect(result.current.card?.items.map(item => item.id)).toEqual([
      'stock',
      'shop',
      'cook',
      'plan',
    ]);
    expect(result.current.card?.doneCount).toBe(0);
  });

  it('An existing user updates the app: no card', () => {
    signIn(OLD);

    const { result } = renderCard();

    expect(result.current.card).toBeNull();
  });

  it('A member who may not add to the pantry: no stock or shop item', () => {
    signIn(NEW);
    jest.mocked(usePantryPermissions).mockReturnValue({
      canAddItems: false,
      canEditItems: false,
      canRemoveItems: false,
      canCreatePantry: false,
      canDeletePantry: false,
    });

    const { result } = renderCard();

    expect(result.current.card?.items.map(item => item.id)).toEqual([
      'cook',
      'plan',
    ]);
  });

  it('Staples picked in onboarding: stocking is already done', () => {
    signIn(NEW);

    const { result } = renderCard(3);

    expect(doneOf(result.current.card).stock).toBe(true);
  });

  it('Done without the guide, or on another phone: planning and cooking tick from the account', async () => {
    signIn(NEW);

    const { result, answered } = renderCard(
      0,
      accountMock({ cooked: 1, planned: 2 }),
    );

    await answered();
    expect(doneOf(result.current.card).plan).toBe(true);
    expect(doneOf(result.current.card).cook).toBe(true);
  });

  it('counts each item done once in the funnel', () => {
    signIn(NEW);
    jest.mocked(Telemetry.trackEvent).mockClear();

    const { rerender } = renderCard(3);
    rerender({ count: 4 });

    expect(
      jest
        .mocked(Telemetry.trackEvent)
        .mock.calls.filter(([name]) => name === 'getting_started_item_done'),
    ).toEqual([['getting_started_item_done', { item: 'stock' }]]);
  });

  it('ticks shopping once a bought item is moved to the pantry', async () => {
    signIn(NEW);
    const { result } = renderCard();

    act(() => emitTutorialEvent('list.movedToPantry'));

    expect(doneOf(result.current.card).shop).toBe(true);
  });

  it('Offline on Today: a done item stays done with nothing read', () => {
    signIn(NEW);
    act(() => useStore.getState().markGettingStartedDone('u1', ['stock']));

    const { result } = renderCard(null);

    expect(doneOf(result.current.card).stock).toBe(true);
  });

  it('Hiding the card: gone, including after a restart', () => {
    signIn(NEW);
    const first = renderCard();

    act(() => first.result.current.hide());
    expect(first.result.current.card).toBeNull();
    first.unmount();

    expect(renderCard().result.current.card).toBeNull();
  });

  it('The last item: the card says so once, then does not appear again', async () => {
    signIn(NEW);
    act(() =>
      useStore.getState().markGettingStartedDone('u1', ['shop', 'cook']),
    );
    const first = renderCard(4, accountMock({ planned: 1 }));

    await first.answered();
    expect(first.result.current.card?.allDone).toBe(true);
    first.unmount();

    expect(useStore.getState().gettingStarted.u1?.retired).toBe(true);
    expect(renderCard(4).result.current.card).toBeNull();
  });

  // Last: the suppression lasts for the process.
  it('stays out of the way of a Detox run', () => {
    signIn(NEW);
    suppressFeatureHintsForE2E();

    expect(renderCard().result.current.card).toBeNull();
  });
});
