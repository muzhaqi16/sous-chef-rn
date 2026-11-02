'use no memo';

jest.mock('#/services/errorService');

import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import {
  CreateHomeDocument,
  GetHomesDocument,
} from '#operations/home/home.generated';
import { CreatePantryDocument } from '#features/pantry/graphql/pantry.generated';
import {
  CreateShoppingListDocument,
  GetShoppingListsLiteDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { Home_RowFragmentDoc } from '#features/home/cache/home.generated';
import { useStore } from '#store';
import {
  useOnboardingSetup,
  type OnboardingSetupOutcome,
} from '../useOnboardingSetup';

const USER = {
  id: 'user-1',
  email: 'maya@example.com',
  firstName: 'Maya',
  emailVerified: true,
  onBoarded: false,
};

const homesMock = (
  homes: { id: string; name: string; pantries: string[] }[] = [],
) =>
  recordMock(GetHomesDocument, {
    data: {
      homes: {
        edges: homes.map(home => ({
          cursor: home.id,
          node: {
            id: home.id,
            name: home.name,
            pantriesConnection: {
              edges: home.pantries.map((id, index) => ({
                node: { id, isDefault: index === 0 },
              })),
            },
          },
        })),
      },
    },
  });

const listsMock = (lists: { id: string }[] = []) =>
  recordMock(GetShoppingListsLiteDocument, {
    data: {
      shoppingLists: {
        edges: lists.map(list => ({
          cursor: list.id,
          node: { id: list.id, isDefault: true },
        })),
      },
    },
  });

// Offline, each local-first create is queued and answers with its minted id.
const queuedHome = () =>
  recordMock(CreateHomeDocument, { data: { createHome: null } });
const queuedPantry = () =>
  recordMock(CreatePantryDocument, { data: { createPantry: null } });
const queuedList = () =>
  recordMock(CreateShoppingListDocument, {
    data: { createShoppingList: null },
  });

async function renderSetup(...mocks: ReturnType<typeof recordMock>[]) {
  const cache = seedCache([]);
  const rendered = renderHookWithApollo(() => useOnboardingSetup(), {
    cache,
    operationMocks: mocks.map(m => m.mock),
  });
  await drainTimers();
  expect(rendered.result.current.loading).toBe(false);
  return { ...rendered, cache };
}

async function runSetup(
  rendered: Awaited<ReturnType<typeof renderSetup>>,
  createMissingHome = true,
): Promise<OnboardingSetupOutcome> {
  let outcome: OnboardingSetupOutcome = { status: 'failed', message: '' };
  outcome = await drained(() =>
    rendered.result.current.run({ createMissingHome }),
  );
  return outcome;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useOnboardingSetup, a read that fails', () => {
  const failedHomes = () =>
    recordMock(GetHomesDocument, { error: new Error('network down') });
  const failedLists = () =>
    recordMock(GetShoppingListsLiteDocument, {
      error: new Error('network down'),
    });

  beforeEach(() => {
    useStore.setState({ user: USER });
  });

  afterEach(() => {
    useStore.setState({ user: null });
  });

  it('reports failed homes, which are not "no home"', async () => {
    const { result } = await renderSetup(failedHomes(), listsMock());

    expect(result.current.readState).toBe('error');
    expect(result.current.hasHome).toBe(false);
  });

  it('reports failed lists, which are not "no list"', async () => {
    const { result } = await renderSetup(
      homesMock([{ id: 'home-1', name: 'Home', pantries: ['p1'] }]),
      failedLists(),
    );

    expect(result.current.readState).toBe('error');
    expect(result.current.hasHome).toBe(true);
  });

  it('asks both again on a retry', async () => {
    const homes = failedHomes();
    const lists = listsMock();
    const { result } = await renderSetup(homes, lists);
    const asked = homes.fired.length;

    result.current.retryRead();
    await drainTimers();
    expect(homes.fired.length).toBe(asked + 1);
  });

  it('keeps the home it holds when the read fails', async () => {
    const cache = seedCache([]);
    seedQuery(cache, {
      query: GetHomesDocument,
      data: {
        homes: {
          edges: [
            {
              cursor: 'home-1',
              node: {
                id: 'home-1',
                name: 'Home',
                pantriesConnection: { edges: [] },
              },
            },
          ],
        },
      },
    });
    const homes = failedHomes();
    const rendered = renderHookWithApollo(() => useOnboardingSetup(), {
      cache,
      operationMocks: [homes.mock, listsMock().mock],
    });

    await drainTimers();
    expect(homes.fired).toHaveLength(1);
    expect(rendered.result.current.hasHome).toBe(true);
    expect(rendered.result.current.readState).not.toBe('error');
  });
});

describe('useOnboardingSetup, offline', () => {
  beforeEach(() => {
    useStore.setState({
      user: USER,
      apiReachable: false,
      isOnline: false,
      selectedHomeId: null,
      selectedPantryId: null,
      selectedShoppingListId: null,
    });
  });

  afterEach(() => {
    useStore.setState({ user: null, apiReachable: true, isOnline: true });
    jest.clearAllMocks();
  });

  it('creates a home, its pantry and a list with default names, and selects them', async () => {
    const home = queuedHome();
    const pantry = queuedPantry();
    const list = queuedList();
    const rendered = await renderSetup(
      homesMock(),
      listsMock(),
      home,
      pantry,
      list,
    );

    expect(await runSetup(rendered)).toEqual({ status: 'done' });

    expect(home.fired[0]).toMatchObject({
      input: { name: "Maya's home", allowJoinCode: true },
    });
    const homeId = (home.fired[0]?.input as { id: string }).id;
    expect(pantry.fired[0]).toMatchObject({
      input: { homeId, name: 'Kitchen Pantry', isDefault: true },
    });
    expect(list.fired[0]).toMatchObject({
      input: { name: 'Weekly Groceries', homeId },
    });

    const state = useStore.getState();
    expect(state.selectedHomeId).toBe(homeId);
    expect(state.selectedPantryId).toBe(
      (pantry.fired[0]?.input as { id: string }).id,
    );
    expect(state.selectedShoppingListId).toBe(
      (list.fired[0]?.input as { id: string }).id,
    );
    expect(
      rendered.cache.readFragment<{ name: string }>({
        id: rendered.cache.identify({ __typename: 'Home', id: homeId }),
        fragment: Home_RowFragmentDoc,
        fragmentName: 'home_row',
        optimistic: true,
      })?.name,
    ).toBe("Maya's home");
  });

  it('creates nothing when the home, its pantry and a list are already there', async () => {
    const home = queuedHome();
    const pantry = queuedPantry();
    const list = queuedList();
    const rendered = await renderSetup(
      homesMock([{ id: 'home-1', name: 'Test Home', pantries: ['pantry-1'] }]),
      listsMock([{ id: 'list-1' }]),
      home,
      pantry,
      list,
    );

    expect(await runSetup(rendered)).toEqual({ status: 'done' });

    expect(home.fired).toHaveLength(0);
    expect(pantry.fired).toHaveLength(0);
    expect(list.fired).toHaveLength(0);
    const state = useStore.getState();
    expect(state.selectedHomeId).toBe('home-1');
    expect(state.selectedPantryId).toBe('pantry-1');
    expect(state.selectedShoppingListId).toBe('list-1');
  });

  it('creates only the pantry for a home without one', async () => {
    const home = queuedHome();
    const pantry = queuedPantry();
    const rendered = await renderSetup(
      homesMock([{ id: 'home-1', name: 'Test Home', pantries: [] }]),
      listsMock([{ id: 'list-1' }]),
      home,
      pantry,
    );

    expect(await runSetup(rendered)).toEqual({ status: 'done' });

    expect(home.fired).toHaveLength(0);
    expect(pantry.fired[0]).toMatchObject({ input: { homeId: 'home-1' } });
  });

  it('creates no home when told not to, and keeps the list personal', async () => {
    const home = queuedHome();
    const list = queuedList();
    const rendered = await renderSetup(homesMock(), listsMock(), home, list);

    expect(await runSetup(rendered, false)).toEqual({ status: 'done' });

    expect(home.fired).toHaveLength(0);
    expect(list.fired[0]?.input).not.toHaveProperty(
      'homeId',
      expect.anything(),
    );
    expect(useStore.getState().selectedHomeId).toBeNull();
  });

  it('asks for no join code while the email is unverified', async () => {
    useStore.setState({ user: { ...USER, emailVerified: false } });
    const home = queuedHome();
    const rendered = await renderSetup(
      homesMock(),
      listsMock(),
      home,
      queuedPantry(),
      queuedList(),
    );

    await runSetup(rendered);

    expect(home.fired[0]).toMatchObject({ input: { allowJoinCode: false } });
  });
});

describe('useOnboardingSetup, a refused create', () => {
  beforeEach(() => {
    useStore.setState({ user: USER, apiReachable: true, isOnline: true });
  });

  afterEach(() => {
    useStore.setState({ user: null });
    jest.clearAllMocks();
  });

  it('reports the refusal and goes no further', async () => {
    const refused = recordMock(CreateHomeDocument, {
      error: new Error('Home limit reached'),
    });
    const pantry = queuedPantry();
    const list = queuedList();
    const rendered = await renderSetup(
      homesMock(),
      listsMock(),
      refused,
      pantry,
      list,
    );

    const outcome = await runSetup(rendered);

    expect(outcome.status).toBe('failed');
    expect(pantry.fired).toHaveLength(0);
    expect(list.fired).toHaveLength(0);
  });
});
