import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { PendingWrites } from '#/apollo/pendingWrites/pendingWrites';
import type { PendingWrite } from '#/apollo/pendingWrites/types';
import {
  completeSeed,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { RemoveDietaryRestrictionDocument } from '#operations/user/user.generated';
import type { LocalBrandEntry } from '#features/profile/cache/brandLists';
import {
  AddBrandToListDocument,
  BrandListsDocument,
  CreateBrandListDocument,
  DeleteBrandListDocument,
  RemoveBrandFromListDocument,
} from '#features/profile/hooks/useBrandLists.generated';
import {
  addBrand,
  createBrandList,
  removeBrand,
  removeBrandList,
  removeRestriction,
  type AddBrandInputs,
  type CreateBrandListInputs,
  type RemoveBrandInputs,
  type RemoveRestrictionInputs,
} from '../localWrites';

const LIST_ID = 'list-1';
const PROFILE_ID = 'profile-1';

const RESTRICTIONS = gql`
  fragment LocalWritesRestrictions on DietaryProfile {
    id
    restrictions {
      id
    }
  }
`;

const entry = (id: string, brandId: string): LocalBrandEntry => ({
  __typename: 'BrandListEntry',
  id,
  reason: null,
  version: 1,
  brand: {
    __typename: 'Brand',
    id: brandId,
    name: `Brand ${brandId}`,
    version: 1,
  },
});

function setup() {
  const cache = makeCache();
  seedQuery(cache, {
    query: BrandListsDocument,
    data: {
      brandLists: [
        {
          __typename: 'BrandList',
          id: LIST_ID,
          name: 'Avoid',
          enabled: true,
          entries: [entry('entry-1', 'brand-1')],
        },
      ],
    },
  });
  seedFragment(cache, {
    fragment: RESTRICTIONS,
    data: {
      __typename: 'DietaryProfile',
      id: PROFILE_ID,
      restrictions: [{ __typename: 'DietaryRestriction', id: 'held' }],
    },
  });
  const table = {
    CreateBrandList: createBrandList,
    DeleteBrandList: removeBrandList,
    AddBrandToList: addBrand,
    RemoveBrandFromList: removeBrand,
    RemoveDietaryRestriction: removeRestriction,
  };
  return { cache, writes: new PendingWrites(cache, table) };
}

type Setup = ReturnType<typeof setup>;

const lists = ({ cache }: Setup, optimistic = true) =>
  cache
    .readQuery({ query: BrandListsDocument, optimistic })
    ?.brandLists.map(list => list.id);

const entries = ({ cache }: Setup, optimistic = true) =>
  cache
    .readQuery({ query: BrandListsDocument, optimistic })
    ?.brandLists[0]?.entries.map(({ id }) => id);

const restrictions = ({ cache }: Setup, optimistic = true) =>
  cache
    .readFragment<{ restrictions: { id: string }[] }>({
      id: cache.identify({ __typename: 'DietaryProfile', id: PROFILE_ID }),
      fragment: RESTRICTIONS,
      optimistic,
    })
    ?.restrictions.map(({ id }) => id);

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

const create = ({ writes }: Setup) => {
  const inputs: CreateBrandListInputs = { name: 'Prefer' };
  return writes.begin(
    CreateBrandListDocument,
    { input: { id: 'minted', name: 'Prefer', enabled: true } },
    inputs,
  );
};

const add = ({ writes }: Setup) => {
  const inputs: AddBrandInputs = {
    listId: LIST_ID,
    entry: entry('entry-new', 'brand-2'),
  };
  return writes.begin(
    AddBrandToListDocument,
    {
      input: { id: 'entry-new', brandListId: LIST_ID, brandId: 'brand-2' },
    },
    inputs,
  );
};

const removeEntry = ({ writes }: Setup) => {
  const inputs: RemoveBrandInputs = { listId: LIST_ID };
  return writes.begin(
    RemoveBrandFromListDocument,
    { input: { id: 'entry-1' } },
    inputs,
  );
};

const removeHeldRestriction = ({ writes }: Setup) => {
  const inputs: RemoveRestrictionInputs = { profileId: PROFILE_ID };
  return writes.begin(
    RemoveDietaryRestrictionDocument,
    { input: { id: 'held' } },
    inputs,
  );
};

describe('a brand list', () => {
  it('shows a new one last, however often it is rebuilt', () => {
    const screen = setup();

    create(screen);
    screen.writes.rebuild();
    screen.writes.rebuild();

    expect(lists(screen)).toEqual([LIST_ID, 'minted']);
    expect(lists(screen, false)).toEqual([LIST_ID]);
  });

  it('ends on the server data when a create is refused', () => {
    const screen = setup();

    screen.writes.drop(create(screen).id);

    expect(lists(screen)).toEqual([LIST_ID]);
    expect(screen.cache.extract(true)['BrandList:minted']).toBeUndefined();
  });

  it('lists a new one in the server data once answered', () => {
    const screen = setup();

    answered(screen, create(screen), {
      createBrandList: {
        __typename: 'CreateBrandListPayload',
        brandList: {
          __typename: 'BrandList',
          id: 'minted',
          name: 'Prefer',
          enabled: true,
          entries: [],
        },
      },
    });

    expect(lists(screen, false)).toEqual([LIST_ID, 'minted']);
  });

  it('hides a deleted one, shows it when refused, and keeps it gone once answered', () => {
    const screen = setup();
    const remove = () =>
      screen.writes.begin(DeleteBrandListDocument, {
        input: { id: LIST_ID },
      });

    const refused = remove();
    screen.writes.rebuild();
    expect(lists(screen)).toEqual([]);
    screen.writes.drop(refused.id);
    expect(lists(screen)).toEqual([LIST_ID]);

    answered(screen, remove(), {
      deleteBrandList: {
        __typename: 'DeleteBrandListPayload',
        converged: false,
        brandList: { __typename: 'BrandList', id: LIST_ID },
      },
    });
    expect(lists(screen, false)).toEqual([]);
  });
});

describe('a brand on a list', () => {
  it('shows an added one, and ends on the server data when refused', () => {
    const screen = setup();

    const write = add(screen);
    screen.writes.rebuild();
    expect(entries(screen)).toEqual(['entry-1', 'entry-new']);

    screen.writes.drop(write.id);
    expect(entries(screen)).toEqual(['entry-1']);
  });

  it('hides a removed one, and puts it back when refused', () => {
    const screen = setup();

    const write = removeEntry(screen);
    screen.writes.rebuild();
    expect(entries(screen)).toEqual([]);
    expect(entries(screen, false)).toEqual(['entry-1']);

    screen.writes.drop(write.id);
    expect(entries(screen)).toEqual(['entry-1']);
  });

  it('keeps a removed one off the list, which the answer does not state', () => {
    const screen = setup();

    answered(screen, removeEntry(screen), {
      removeBrandFromList: {
        __typename: 'RemoveBrandFromListPayload',
        converged: false,
        brandListEntry: { __typename: 'BrandListEntry', id: 'entry-1' },
      },
    });

    expect(entries(screen, false)).toEqual([]);
  });
});

describe('removing a dietary restriction', () => {
  it('takes it off the profile, leaving the server data as it was', () => {
    const screen = setup();

    removeHeldRestriction(screen);
    screen.writes.rebuild();

    expect(restrictions(screen)).toEqual([]);
    expect(restrictions(screen, false)).toEqual(['held']);
  });

  it('puts it back when refused', () => {
    const screen = setup();

    screen.writes.drop(removeHeldRestriction(screen).id);

    expect(restrictions(screen)).toEqual(['held']);
  });

  it('does not revive it through the { id } its answer names', () => {
    const screen = setup();

    answered(screen, removeHeldRestriction(screen), {
      removeRestriction: {
        __typename: 'RemoveRestrictionPayload',
        converged: false,
        dietaryRestriction: { __typename: 'DietaryRestriction', id: 'held' },
      },
    });

    expect(restrictions(screen, false)).toEqual([]);
    expect(screen.cache.extract()['DietaryRestriction:held']).toBeUndefined();
  });
});
