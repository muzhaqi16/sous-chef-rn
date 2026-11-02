import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { PendingWrites } from '#/apollo/pendingWrites/pendingWrites';
import type { PendingWrite } from '#/apollo/pendingWrites/types';
import {
  completeSeed,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { CreateHomeDocument } from '#operations/home/home.generated';
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import {
  Home_RowFragmentDoc,
  type Home_RowFragment,
} from '#features/home/cache/home.generated';
import { placeholderMembershipId } from '#features/home/cache/optimisticHome';
import type { Unmasked } from '@apollo/client/masking';
import {
  createHome,
  markDefaultHome,
  type CreateHomeInputs,
  type MarkDefaultHomeInputs,
} from '../localWrites';

const NOW = '2026-10-30T10:00:00.000Z';
const TODAY = '2026-10-30';
const CREATOR = { id: 'user-1', email: 'a@b.c', displayName: 'A' };

const HOMES = gql`
  query LocalWritesHomes {
    homes {
      edges {
        node {
          id
          isDefault
        }
      }
    }
  }
`;

type Homes = {
  homes: { edges: { node: { id: string; isDefault: boolean } }[] };
};

function setup(
  held: { id: string; isDefault: boolean }[] = [
    { id: 'home-A', isDefault: true },
    { id: 'home-B', isDefault: false },
  ],
) {
  const cache = makeCache();
  seedQuery(cache, {
    query: HOMES,
    data: {
      homes: {
        __typename: 'HomeConnection',
        edges: held.map(home => ({
          __typename: 'HomeEdge',
          node: { __typename: 'Home', ...home },
        })),
      },
    },
  });
  const table = {
    CreateHome: createHome,
    MarkHomeAsDefault: markDefaultHome,
  };
  return { cache, writes: new PendingWrites(cache, table) };
}

type Setup = ReturnType<typeof setup>;

const homes = ({ cache }: Setup, optimistic = true) =>
  cache
    .readQuery<Homes>({ query: HOMES, optimistic })
    ?.homes.edges.map(edge => edge.node.id);

const defaults = ({ cache }: Setup, optimistic = true) =>
  cache
    .readQuery<Homes>({ query: HOMES, optimistic })
    ?.homes.edges.filter(edge => edge.node.isDefault)
    .map(edge => edge.node.id);

const home = ({ cache }: Setup, id: string, optimistic = true) =>
  cache.readFragment<Unmasked<Home_RowFragment>>({
    id: cache.identify({ __typename: 'Home', id }),
    fragment: Home_RowFragmentDoc,
    fragmentName: 'home_row',
    optimistic,
  });

/** The server answers: Apollo writes it to the root, then the write commits. */
function answered(
  { cache, writes }: Setup,
  { id, document, variables }: PendingWrite,
  data: Record<string, unknown>,
): void {
  const stated = completeSeed(document, variables, data);
  seedQuery(cache, {
    id: 'ROOT_MUTATION',
    query: document,
    variables,
    data: stated,
  });
  writes.confirm(id, stated);
  writes.rebuild();
}

const create = ({ writes }: Setup, id: string) => {
  const input = { id, name: 'Cabin', createDefaultPantry: false };
  const inputs: CreateHomeInputs = {
    home: input,
    creator: CREATOR,
    now: NOW,
  };
  return writes.begin(CreateHomeDocument, { input }, inputs);
};

const markDefault = ({ writes }: Setup, homeId: string) => {
  const inputs: MarkDefaultHomeInputs = { homeId };
  return writes.begin(
    MarkHomeAsDefaultDocument,
    { input: { homeId }, today: TODAY },
    inputs,
  );
};

const defaultAnswer = {
  markHomeAsDefault: {
    __typename: 'MarkHomeAsDefaultPayload',
    settings: { __typename: 'UserSettings', id: 'settings-1' },
    defaultPantry: null,
  },
};

describe('creating a home', () => {
  it('shows it after the homes held, however often it is rebuilt', () => {
    const screen = setup();

    create(screen, 'minted');
    screen.writes.rebuild();
    screen.writes.rebuild();

    expect(homes(screen)).toEqual(['home-A', 'home-B', 'minted']);
    expect(homes(screen, false)).toEqual(['home-A', 'home-B']);
  });

  it('gives its creator every capability an owner has, read complete', () => {
    const screen = setup();

    create(screen, 'minted');
    screen.writes.rebuild();

    expect(home(screen, 'minted')?.myMembership).toMatchObject({
      id: placeholderMembershipId('minted'),
      canManageHome: true,
      canEditPantry: true,
    });
  });

  it('dates the row when it was made, not when it is rebuilt', () => {
    const screen = setup();

    create(screen, 'minted');
    screen.writes.rebuild();

    expect(home(screen, 'minted')).toMatchObject({ createdAt: NOW });
  });

  it('leaves nothing when refused', () => {
    const screen = setup();

    screen.writes.drop(create(screen, 'minted').id);

    expect(homes(screen)).toEqual(['home-A', 'home-B']);
    expect(screen.cache.extract(true)['Home:minted']).toBeUndefined();
  });

  it('commits the membership the server made, and no placeholder', () => {
    const screen = setup();

    answered(screen, create(screen, 'minted'), {
      createHome: {
        __typename: 'CreateHomePayload',
        home: {
          __typename: 'Home',
          id: 'minted',
          myMembership: { __typename: 'Membership', id: 'server-membership' },
          membersConnection: {
            __typename: 'MembershipConnection',
            edges: [
              {
                __typename: 'MembershipEdge',
                node: { __typename: 'Membership', id: 'server-membership' },
              },
            ],
            totalCount: 1,
          },
        },
      },
    });

    const root = screen.cache.extract();
    expect(homes(screen, false)).toEqual(['home-A', 'home-B', 'minted']);
    expect(root['Home:minted']).toMatchObject({
      myMembership: { __ref: 'Membership:server-membership' },
    });
    expect(
      root[`Membership:${placeholderMembershipId('minted')}`],
    ).toBeUndefined();
  });
});

describe('marking a home as the default', () => {
  it('moves the flag, leaving the server data as it was', () => {
    const screen = setup();

    markDefault(screen, 'home-B');
    screen.writes.rebuild();

    expect(defaults(screen)).toEqual(['home-B']);
    expect(defaults(screen, false)).toEqual(['home-A']);
  });

  it('puts back the exact flags when refused', () => {
    const screen = setup();

    screen.writes.drop(markDefault(screen, 'home-B').id);

    expect(defaults(screen)).toEqual(['home-A']);
  });

  it('leaves every flag alone when refused and no home held it', () => {
    const screen = setup([
      { id: 'home-A', isDefault: false },
      { id: 'home-B', isDefault: false },
    ]);

    screen.writes.drop(markDefault(screen, 'home-B').id);

    expect(defaults(screen)).toEqual([]);
  });

  it('keeps the flag once answered, as the payload never returns it', () => {
    const screen = setup();

    answered(screen, markDefault(screen, 'home-B'), defaultAnswer);

    expect(defaults(screen, false)).toEqual(['home-B']);
  });

  it('reaches a home created behind it in the same queue', () => {
    const screen = setup();

    create(screen, 'minted');
    markDefault(screen, 'minted');
    screen.writes.rebuild();

    expect(defaults(screen)).toEqual(['minted']);
  });

  it('reaches a target the cache only holds by the time it commits', () => {
    const screen = setup();
    const write = markDefault(screen, 'home-new');
    screen.writes.rebuild();
    expect(defaults(screen)).toEqual(['home-A']);

    seedFragment(screen.cache, {
      id: 'Home:home-new',
      fragment: gql`
        fragment LocalWritesArrived on Home {
          id
          isDefault
        }
      `,
      data: { __typename: 'Home', id: 'home-new', isDefault: false },
    });
    answered(screen, write, defaultAnswer);

    expect(defaults(screen, false)).toEqual([]);
    expect(screen.cache.extract()['Home:home-new']).toMatchObject({
      isDefault: true,
    });
  });
});
