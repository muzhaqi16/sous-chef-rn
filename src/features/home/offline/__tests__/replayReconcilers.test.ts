import { makeCache } from '#/apollo/cache';
import {
  buildOptimisticHome,
  placeholderMembershipId,
  writeOptimisticHome,
} from '#features/home/cache/optimisticHome';
import { Home_HomeDetailFragmentDoc } from '#features/home/cache/home.generated';
import { HOME_REPLAY_RECONCILERS } from '../replayReconcilers';

/**
 * The membership row is the ONE row a home create cannot key: `CreateHomeInput`
 * carries the home's id, not its membership's. So the placeholder the create
 * wrote has to give way to whatever the server minted, or the home ends up
 * carrying two members — one of them a row nobody can act on.
 */

const HOME_ID = 'client-home-1';
const CREATOR = {
  id: 'user-1',
  email: 'tani@example.com',
  displayName: 'Tani',
};

const seedCreatedHome = () => {
  const cache = makeCache();
  writeOptimisticHome(
    cache,
    buildOptimisticHome(
      HOME_ID,
      { name: 'Offline Home', id: HOME_ID },
      CREATOR,
    ),
  );
  return cache;
};

const readHome = (cache: ReturnType<typeof makeCache>) =>
  cache.readFragment<{
    myMembership: { id: string; role: string; canEditPantry: boolean } | null;
    membersConnection: {
      edges: Array<{ node: { id: string; userId: string } }>;
    };
  }>({
    id: cache.identify({ __typename: 'Home', id: HOME_ID }),
    fragment: Home_HomeDetailFragmentDoc,
    fragmentName: 'home_homeDetail',
  });

const replay = (cache: ReturnType<typeof makeCache>, data: unknown) =>
  HOME_REPLAY_RECONCILERS.CreateHome?.(cache, { input: { id: HOME_ID } }, data);

const payloadWithMembership = (membershipId: string | null) => ({
  createHome: {
    __typename: 'CreateHomePayload',
    home: {
      __typename: 'Home',
      id: HOME_ID,
      myMembership: membershipId
        ? { __typename: 'Membership', id: membershipId }
        : null,
    },
  },
});

describe('adopting the server membership on a CreateHome replay', () => {
  it('replaces the placeholder with the server row, carrying its fields', () => {
    const cache = seedCreatedHome();
    expect(readHome(cache)?.myMembership?.id).toBe(
      placeholderMembershipId(HOME_ID),
    );

    replay(cache, payloadWithMembership('server-membership-1'));

    const home = readHome(cache);
    expect(home?.myMembership?.id).toBe('server-membership-1');
    // The server's own selection carries neither, so they come across from the
    // placeholder or the home reads incomplete.
    expect(home?.myMembership?.role).toBe('OWNER');
    expect(home?.myMembership?.canEditPantry).toBe(true);
  });

  it('repoints the member edge, so the home has one member and not two', () => {
    const cache = seedCreatedHome();

    replay(cache, payloadWithMembership('server-membership-1'));

    const edges = readHome(cache)?.membersConnection.edges ?? [];
    expect(edges.map(e => e.node.id)).toEqual(['server-membership-1']);
    expect(edges[0]?.node.userId).toBe('user-1');
  });

  it('evicts the placeholder, so nothing can read it back', () => {
    const cache = seedCreatedHome();

    replay(cache, payloadWithMembership('server-membership-1'));

    expect(
      cache.extract()[`Membership:${placeholderMembershipId(HOME_ID)}`],
    ).toBeUndefined();
  });

  it('changes nothing when the server returned the id the client wrote', () => {
    const cache = seedCreatedHome();
    const placeholderId = placeholderMembershipId(HOME_ID);

    replay(cache, payloadWithMembership(placeholderId));

    expect(readHome(cache)?.myMembership?.id).toBe(placeholderId);
  });

  it('leaves the home alone when the payload names no membership', () => {
    const cache = seedCreatedHome();

    replay(cache, payloadWithMembership(null));

    expect(readHome(cache)?.myMembership?.id).toBe(
      placeholderMembershipId(HOME_ID),
    );
  });

  // The queue can drain the same entry twice; the second pass must not undo
  // the first by evicting the row it just adopted.
  it('is idempotent across a re-drain', () => {
    const cache = seedCreatedHome();

    replay(cache, payloadWithMembership('server-membership-1'));
    replay(cache, payloadWithMembership('server-membership-1'));

    const home = readHome(cache);
    expect(home?.myMembership?.id).toBe('server-membership-1');
    expect(home?.membersConnection.edges).toHaveLength(1);
  });
});
