'use no memo';

import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import { MealPlanSubtype, MutationType } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store/index';
import { useMealPlanSubscriptions } from '#features/mealPlan/hooks/useMealPlanSubscriptions';

type CapturedOnData = (data: unknown, client: unknown) => void;

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockRegister = jest.fn().mockReturnValue({});
const mockIsPendingDelete = jest.fn().mockReturnValue(false);
const mockHasPendingDeletes = jest.fn(() => false);

jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (config: SubscriptionConfig) => mockRegister(config),
    isPendingDelete: (id: string) => mockIsPendingDelete(id),
    hasPendingDeletes: () => mockHasPendingDeletes(),
  },
}));

const mockAddToMealPlans = jest.fn();
const mockAddToMealTemplates = jest.fn();
const mockRemoveFromMealPlans = jest.fn();
const mockRemoveFromMealTemplates = jest.fn();
const mockAddToMealPlanItems = jest.fn();
const mockRemoveFromMealPlanItems = jest.fn();
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  // The updater factories are stubbed so each call site can be asserted, but
  // the pure helpers keep their real behaviour — a fully-partial factory drops
  // whatever the module gains next.
  ...jest.requireActual('#/apollo/utils/cacheUpdaters'),
  createAddToQueryConnectionUpdater: (fieldName: string) =>
    fieldName === 'mealPlans'
      ? (...args: unknown[]) => mockAddToMealPlans(...args)
      : (...args: unknown[]) => mockAddToMealTemplates(...args),
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

const makeClient = (
  readFragment: jest.Mock = jest.fn(),
  query: jest.Mock = jest.fn().mockResolvedValue({ data: {} }),
) => ({
  cache: { readFragment },
  refetchQueries: jest.fn(),
  query,
});

/** The read-back is a promise, so the handler finishes a microtask later. */
const deliver = async (
  onData: CapturedOnData,
  payload: unknown,
  client: unknown,
) => {
  await act(async () => {
    onData(payload, client);
  });
};

/**
 * The plan-aggregates refetch is debounced and waits out in-flight deletes, so
 * a synchronous assertion right after the event sees nothing. Run the timers to
 * reach the read the handler actually scheduled.
 */
const flushAggregateRefresh = () => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRegister.mockReturnValue({});
  mockIsPendingDelete.mockReturnValue(false);
  mockHasPendingDeletes.mockReturnValue(false);
  useStore.setState({
    selectedHomeId: 'home-1',
    isHomeSelectionReady: true,
    selectedMealPlanId: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
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

  it('reads a plan created elsewhere back before adding it', async () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient(
      jest.fn(),
      jest.fn().mockResolvedValue({
        data: { mealPlan: { __typename: 'MealPlan', id: 'plan-new' } },
      }),
    );

    await deliver(
      getOnData(),
      {
        subtype: MealPlanSubtype.MealPlanChanged,
        mutation: MutationType.Created,
        mealPlanId: 'plan-new',
        actorUserId: 'user-2',
        node: { __typename: 'MealPlan', id: 'plan-new' },
      },
      client,
    );

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { id: 'plan-new' } }),
    );
    // The ref, not the read-back object: handing the denormalized read to the
    // updater would inline `home`/`user`/`createdBy` over their entity refs.
    expect(mockAddToMealPlans).toHaveBeenCalledWith(
      client.cache,
      { __typename: 'MealPlan', id: 'plan-new' },
      { position: 'start' },
    );
  });

  it('skips the add when the plan cannot be read back', async () => {
    // Offline, or deleted between the event and the read. Adding an entity the
    // overview cannot render completely would blank the list.
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient(
      jest.fn(),
      jest.fn().mockResolvedValue({ data: { mealPlan: null } }),
    );

    await deliver(
      getOnData(),
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
  });

  it('re-reads a plan updated elsewhere without touching the connection', async () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient(jest.fn());

    await deliver(
      getOnData(),
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
    // The event carries no values, so the plan itself has to be re-read.
    flushAggregateRefresh();
    expect(client.refetchQueries).toHaveBeenCalled();
  });

  it('refreshes the plan when an item is added elsewhere', () => {
    // One plan read answers both halves — array membership and the
    // server-computed totals — so an item add costs no read of its own.
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient();

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

    expect(client.query).not.toHaveBeenCalled();
    flushAggregateRefresh();
    expect(client.refetchQueries).toHaveBeenCalled();
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

  it('reads a template created elsewhere back before adding it', async () => {
    // The template browser is a sheet whose query mounts once with the screen,
    // so "it'll arrive on the next read" never happens while it stays mounted.
    const template = { __typename: 'MealTemplate', id: 'tpl-new' };
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const client = makeClient(
      jest.fn().mockReturnValue(template),
      jest.fn().mockResolvedValue({ data: { mealTemplate: template } }),
    );

    await deliver(
      getOnData(),
      {
        subtype: MealPlanSubtype.MealTemplateChanged,
        mutation: MutationType.Created,
        templateId: 'tpl-new',
        actorUserId: 'user-2',
        node: { __typename: 'MealTemplate', id: 'tpl-new' },
      },
      client,
    );

    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { id: 'tpl-new' } }),
    );
    expect(mockAddToMealTemplates).toHaveBeenCalledWith(
      client.cache,
      template,
      expect.objectContaining({ position: 'start' }),
    );
  });

  it('skips an incomplete template rather than blanking the list', async () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useMealPlanSubscriptions('user-1'));
    const template = { __typename: 'MealTemplate', id: 'tpl-new' };

    await deliver(
      getOnData(),
      {
        subtype: MealPlanSubtype.MealTemplateChanged,
        mutation: MutationType.Created,
        templateId: 'tpl-new',
        actorUserId: 'user-2',
        node: { __typename: 'MealTemplate', id: 'tpl-new' },
      },
      // The read-back landed, but the cache still can't satisfy
      // MealTemplateDisplay — adding it anyway would blank the browser sheet.
      makeClient(
        jest.fn().mockReturnValue(null),
        jest.fn().mockResolvedValue({ data: { mealTemplate: template } }),
      ),
    );

    expect(mockAddToMealTemplates).not.toHaveBeenCalled();
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
