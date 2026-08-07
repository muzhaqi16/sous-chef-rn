'use no memo';

import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import { MealPlanSubtype, MutationType } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store/index';
import { useMealPlanSubscriptions } from '../useMealPlanSubscriptions';

type CapturedOnData = (data: unknown, client: unknown) => void;

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockRegister = jest.fn().mockReturnValue({});
const mockIsPendingDelete = jest.fn().mockReturnValue(false);
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (config: SubscriptionConfig) => mockRegister(config),
    isPendingDelete: (id: string) => mockIsPendingDelete(id),
  },
}));

const mockAddToMealPlans = jest.fn();
const mockRemoveFromMealPlans = jest.fn();
const mockRemoveFromMealTemplates = jest.fn();
const mockAddToMealPlanItems = jest.fn();
const mockRemoveFromMealPlanItems = jest.fn();
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToQueryConnectionUpdater:
    () =>
    (...args: unknown[]) =>
      mockAddToMealPlans(...args),
  createRemoveFromQueryConnectionUpdater: (fieldName: string) =>
    fieldName === 'mealPlans'
      ? (...args: unknown[]) => mockRemoveFromMealPlans(...args)
      : (...args: unknown[]) => mockRemoveFromMealTemplates(...args),
  createAddToParentArrayUpdater:
    () =>
    (...args: unknown[]) =>
      mockAddToMealPlanItems(...args),
  createRemoveFromParentArrayUpdater:
    () =>
    (...args: unknown[]) =>
      mockRemoveFromMealPlanItems(...args),
}));

/** Captures the hook's customOnData so tests can drive it with a payload. */
function captureCustomOnData() {
  let customOnData: CapturedOnData | undefined;
  mockRegister.mockImplementation((config: SubscriptionConfig) => {
    customOnData = config.customOnData as CapturedOnData | undefined;
    return {};
  });
  return (): CapturedOnData => {
    if (!customOnData) throw new Error('customOnData was not captured');
    return customOnData;
  };
}

const makeClient = (readFragment: jest.Mock = jest.fn()) => ({
  cache: { readFragment },
  refetchQueries: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRegister.mockReturnValue({});
  mockIsPendingDelete.mockReturnValue(false);
  useStore.setState({
    selectedHomeId: 'home-1',
    isHomeSelectionReady: true,
    selectedMealPlanId: null,
  });
});

describe('useMealPlanSubscriptions', () => {
  it('subscribes for the selected home', () => {
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));

    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionName: 'MealPlanEvents',
        entityType: 'MealPlan',
        userId: 'user-1',
        entityId: 'home-1',
      }),
    );
  });

  it('drops a deleted plan and clears the selection naming it', () => {
    useStore.setState({ selectedMealPlanId: 'plan-1' });
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient();

    getOnData()(
      {
        subtype: MealPlanSubtype.MealPlanChanged,
        mutation: MutationType.Deleted,
        mealPlanId: 'plan-1',
        actorUserId: 'user-2',
        node: { __typename: 'MealPlan', id: 'plan-1' },
      },
      client,
    );

    expect(mockRemoveFromMealPlans).toHaveBeenCalledWith(
      client.cache,
      'plan-1',
      {
        evictItem: true,
      },
    );
    expect(useStore.getState().selectedMealPlanId).toBeNull();
    // No refetch: a delete needs nothing beyond the id.
    expect(client.refetchQueries).not.toHaveBeenCalled();
  });

  it('leaves a selection that names a different plan', () => {
    useStore.setState({ selectedMealPlanId: 'plan-mine' });
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));

    getOnData()(
      {
        subtype: MealPlanSubtype.MealPlanChanged,
        mutation: MutationType.Deleted,
        mealPlanId: 'plan-theirs',
        actorUserId: 'user-2',
        node: { __typename: 'MealPlan', id: 'plan-theirs' },
      },
      makeClient(),
    );

    expect(useStore.getState().selectedMealPlanId).toBe('plan-mine');
  });

  it('adds a plan created elsewhere from the pushed payload', () => {
    const plan = { __typename: 'MealPlan', id: 'plan-new', name: 'Camping' };
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient(jest.fn().mockReturnValue(plan));

    getOnData()(
      {
        subtype: MealPlanSubtype.MealPlanChanged,
        mutation: MutationType.Created,
        mealPlanId: 'plan-new',
        actorUserId: 'user-2',
        node: { __typename: 'MealPlan', id: 'plan-new' },
      },
      client,
    );

    expect(mockAddToMealPlans).toHaveBeenCalledWith(client.cache, plan, {
      position: 'start',
    });
    // The payload carried the list-card shape — no network round trip needed.
    expect(client.refetchQueries).not.toHaveBeenCalled();
  });

  it('refetches instead of writing a partial plan when the payload drifted', () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient(jest.fn().mockReturnValue(null));

    getOnData()(
      {
        subtype: MealPlanSubtype.MealPlanChanged,
        mutation: MutationType.Created,
        mealPlanId: 'plan-new',
        actorUserId: 'user-2',
        node: { __typename: 'MealPlan', id: 'plan-new' },
      },
      client,
    );

    expect(mockAddToMealPlans).not.toHaveBeenCalled();
    expect(client.refetchQueries).toHaveBeenCalled();
  });

  it('does nothing for a plan updated elsewhere — normalization covers it', () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient(jest.fn());

    getOnData()(
      {
        subtype: MealPlanSubtype.MealPlanChanged,
        mutation: MutationType.Updated,
        mealPlanId: 'plan-1',
        actorUserId: 'user-2',
        node: { __typename: 'MealPlan', id: 'plan-1' },
      },
      client,
    );

    expect(mockAddToMealPlans).not.toHaveBeenCalled();
    expect(mockRemoveFromMealPlans).not.toHaveBeenCalled();
    expect(client.refetchQueries).not.toHaveBeenCalled();
  });

  it('attaches an item added elsewhere to its plan', () => {
    const item = { __typename: 'MealPlanItem', id: 'item-1' };
    const readFragment = jest.fn().mockReturnValue(item);
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient(readFragment);

    getOnData()(
      {
        subtype: MealPlanSubtype.MealPlanItemChanged,
        mutation: MutationType.ItemAdded,
        mealPlanId: 'plan-1',
        actorUserId: 'user-2',
        node: { __typename: 'MealPlanItem', id: 'item-1' },
      },
      client,
    );

    expect(mockAddToMealPlanItems).toHaveBeenCalledWith(
      client.cache,
      'plan-1',
      expect.objectContaining({ id: 'item-1' }),
      { position: 'end' },
    );
  });

  it('skips an incomplete item rather than blanking the screen', () => {
    // readFragment returns null when the push didn't carry every field the
    // screen fragment needs — adding it would make MealPlanMain incomplete.
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient(jest.fn().mockReturnValue(null));

    getOnData()(
      {
        subtype: MealPlanSubtype.MealPlanItemChanged,
        mutation: MutationType.ItemAdded,
        mealPlanId: 'plan-1',
        actorUserId: 'user-2',
        node: { __typename: 'MealPlanItem', id: 'item-1' },
      },
      client,
    );

    expect(mockAddToMealPlanItems).not.toHaveBeenCalled();
  });

  it('skips an item echo while a local delete is in flight', () => {
    mockIsPendingDelete.mockReturnValue(true);
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));

    getOnData()(
      {
        subtype: MealPlanSubtype.MealPlanItemChanged,
        mutation: MutationType.ItemAdded,
        mealPlanId: 'plan-1',
        actorUserId: 'user-2',
        node: { __typename: 'MealPlanItem', id: 'item-1' },
      },
      makeClient(jest.fn()),
    );

    expect(mockAddToMealPlanItems).not.toHaveBeenCalled();
  });

  it('removes an item deleted elsewhere', () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient();

    getOnData()(
      {
        subtype: MealPlanSubtype.MealPlanItemChanged,
        mutation: MutationType.ItemRemoved,
        mealPlanId: 'plan-1',
        actorUserId: 'user-2',
        node: { __typename: 'MealPlanItem', id: 'item-1' },
      },
      client,
    );

    expect(mockRemoveFromMealPlanItems).toHaveBeenCalledWith(
      client.cache,
      'plan-1',
      'item-1',
      { evictItem: true },
    );
  });

  it('ignores its own echo', () => {
    useStore.setState({ selectedMealPlanId: 'plan-1' });
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));

    getOnData()(
      {
        subtype: MealPlanSubtype.MealPlanChanged,
        mutation: MutationType.Deleted,
        mealPlanId: 'plan-1',
        actorUserId: 'user-1',
        node: { __typename: 'MealPlan', id: 'plan-1' },
      },
      makeClient(),
    );

    expect(mockRemoveFromMealPlans).not.toHaveBeenCalled();
    expect(useStore.getState().selectedMealPlanId).toBe('plan-1');
  });

  it('drops a template deleted elsewhere', () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient();

    getOnData()(
      {
        subtype: MealPlanSubtype.MealTemplateChanged,
        mutation: MutationType.Deleted,
        templateId: 'tpl-1',
        actorUserId: 'user-2',
        node: { __typename: 'MealTemplate', id: 'tpl-1' },
      },
      client,
    );

    expect(mockRemoveFromMealTemplates).toHaveBeenCalledWith(
      client.cache,
      'tpl-1',
      { evictItem: true },
    );
  });
});
