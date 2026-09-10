'use no memo';

jest.mock('#/services/errorService');

import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { CreateHomeDocument } from '#operations/home/home.generated';
import { CreatePantryDocument } from '#features/pantry/graphql/pantry.generated';
import { Home_HomeDetailFragmentDoc } from '#features/home/cache/home.generated';
import { useCreateHome } from '../useCreateHome';
import { useCreatePantry } from '#features/pantry/hooks/useCreatePantry';
import { useStore } from '#store';

/**
 * A home created offline has to be usable before the server has heard of it:
 * every permission gate reads the cache, and a pantry write made in the same
 * session names the home as its parent.
 */

const USER = {
  id: 'user-1',
  email: 'tani@example.com',
  emailVerified: true,
  onBoarded: true,
};

/** Queued: the offline queue answers a create with a null payload. */
const queuedHome = () =>
  recordMock(CreateHomeDocument, { data: { createHome: null } });
const queuedPantry = () =>
  recordMock(CreatePantryDocument, { data: { createPantry: null } });

const readHome = (cache: ReturnType<typeof seedCache>, id: string) =>
  cache.readFragment<{
    name: string;
    myMembership: { role: string; canEditPantry: boolean } | null;
    pantriesConnection: { edges: Array<{ node: { id: string } }> };
  }>({
    id: cache.identify({ __typename: 'Home', id }),
    fragment: Home_HomeDetailFragmentDoc,
    fragmentName: 'home_homeDetail',
  });

describe('creating a home with the API unreachable', () => {
  beforeEach(() => {
    useStore.setState({ user: USER, apiReachable: false, isOnline: false });
  });

  afterEach(() => {
    useStore.setState({ user: null, apiReachable: true, isOnline: true });
    jest.clearAllMocks();
  });

  it('asks the server not to make a pantry, and mints the home id itself', async () => {
    const home = queuedHome();
    const { result } = renderHookWithApollo(() => useCreateHome(), {
      operationMocks: [home.mock],
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.createHome({ name: 'Offline Home' });
    });

    expect(outcome).toMatchObject({ status: 'ok' });
    expect(home.fired).toHaveLength(1);
    expect(home.fired[0]).toMatchObject({
      input: {
        id: (outcome as unknown as { id: string }).id,
        name: 'Offline Home',
        // A server-minted pantry id is one no offline pantry write could name.
        createDefaultPantry: false,
      },
    });
  });

  it('writes the home and an Owner membership every permission gate can read', async () => {
    const home = queuedHome();
    const cache = seedCache([]);
    const { result } = renderHookWithApollo(() => useCreateHome(), {
      cache,
      operationMocks: [home.mock],
    });

    let id = '';
    await act(async () => {
      id = (await result.current.createHome({ name: 'Offline Home' })).id;
    });

    const cached = readHome(cache, id);
    expect(cached?.name).toBe('Offline Home');
    expect(cached?.myMembership).toMatchObject({
      role: 'OWNER',
      canEditPantry: true,
    });
  });

  it('parents the queued pantry to the home, in that order', async () => {
    const home = queuedHome();
    const pantry = queuedPantry();
    const cache = seedCache([]);
    const { result } = renderHookWithApollo(
      () => ({ ...useCreateHome(), ...useCreatePantry() }),
      { cache, operationMocks: [home.mock, pantry.mock] },
    );

    let homeId = '';
    let pantryId = '';
    await act(async () => {
      homeId = (await result.current.createHome({ name: 'Offline Home' })).id;
      pantryId = (
        await result.current.createPantry({ homeId, name: 'Kitchen' })
      ).id;
    });

    // FIFO replay lands the parent before its child, so the order the writes
    // were made in is the order they reach the server.
    expect(home.fired).toHaveLength(1);
    expect(pantry.fired[0]).toMatchObject({
      input: { id: pantryId, homeId, name: 'Kitchen' },
    });

    // And the home already lists it, so the pantry tab has one to open.
    expect(
      readHome(cache, homeId)?.pantriesConnection.edges.map(e => e.node.id),
    ).toEqual([pantryId]);
  });

  it('falls back to online-only with no auth identity to own the home', async () => {
    useStore.setState({ user: null });
    const home = queuedHome();
    const cache = seedCache([]);
    const { result } = renderHookWithApollo(() => useCreateHome(), {
      cache,
      operationMocks: [home.mock],
    });

    let id = '';
    await act(async () => {
      id = (await result.current.createHome({ name: 'Offline Home' })).id;
    });

    // No membership can be materialized for nobody, so no home is written
    // either — rather than one whose permission checks answer for no user.
    expect(cache.extract()[`Home:${id}`]).toBeUndefined();
  });
});
