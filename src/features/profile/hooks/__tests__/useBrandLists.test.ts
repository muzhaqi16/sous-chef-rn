import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { toastService } from '#/services/toastService';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  AddBrandToListDocument,
  BrandListsDocument,
  CreateBrandListDocument,
  DeleteBrandListDocument,
  RemoveBrandFromListDocument,
  UpdateBrandListDocument,
} from '../useBrandLists.generated';
import { useBrandLists } from '../useBrandLists';

jest.mock('#/utils/generateEntityId', () => ({
  generateEntityId: jest.fn(() => 'minted-1'),
}));

const BOYCOTT = {
  id: 'list-boycott',
  name: 'Boycott',
  enabled: true,
  version: 2,
  entries: [
    {
      id: 'entry-soda',
      reason: 'parent company',
      version: 1,
      brand: { id: 'brand-soda', name: 'SodaCo' },
    },
  ],
};
const AVOID = {
  id: 'list-avoid',
  name: 'Avoid',
  enabled: false,
  version: 1,
  entries: [],
};

const listsMock = () =>
  recordMock(BrandListsDocument, { data: { brandLists: [BOYCOTT, AVOID] } });

const refused = (field: string) => ({
  [field]: {
    __typename: 'NotFoundError',
    code: ErrorCode.NotFound,
    message: 'No such list',
  },
});

async function renderLists(...writes: ReturnType<typeof recordMock>[]) {
  const rendered = renderHookWithApollo(() => useBrandLists(), {
    operationMocks: [listsMock().mock, ...writes.map(write => write.mock)],
  });
  await waitFor(() => expect(rendered.result.current.lists).toHaveLength(2));
  return rendered;
}

const listOf = (lists: ReturnType<typeof useBrandLists>['lists'], id: string) =>
  lists.find(list => list.id === id);

beforeEach(() => {
  jest.spyOn(toastService, 'error').mockImplementation();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('useBrandLists', () => {
  it('reads the user’s own lists, each with its brands and notes', async () => {
    const { result } = await renderLists();

    expect(result.current.lists).toEqual([
      {
        id: 'list-boycott',
        name: 'Boycott',
        enabled: true,
        brands: [
          {
            entryId: 'entry-soda',
            brandId: 'brand-soda',
            name: 'SodaCo',
            reason: 'parent company',
          },
        ],
      },
      { id: 'list-avoid', name: 'Avoid', enabled: false, brands: [] },
    ]);
  });

  it('makes a list at once, switched on, under the id it sends', async () => {
    const create = recordMock(CreateBrandListDocument, {
      held: true,
      data: {
        createBrandList: {
          __typename: 'CreateBrandListPayload',
          brandList: {
            id: 'minted-1',
            name: 'Snacks',
            enabled: true,
            version: 1,
            entries: [],
          },
        },
      },
    });
    const { result } = await renderLists(create);

    let made: Promise<string | null> | undefined;
    act(() => {
      made = result.current.createList('Snacks');
    });

    await waitFor(() =>
      expect(listOf(result.current.lists, 'minted-1')).toEqual({
        id: 'minted-1',
        name: 'Snacks',
        enabled: true,
        brands: [],
      }),
    );
    expect(create.fired).toEqual([
      { input: { id: 'minted-1', name: 'Snacks', enabled: true } },
    ]);
    create.release();
    await act(async () => {
      await expect(made).resolves.toBe('minted-1');
    });
  });

  it('takes a refused list back out', async () => {
    const { result } = await renderLists(
      recordMock(CreateBrandListDocument, { data: refused('createBrandList') }),
    );

    let made: string | null = 'unset';
    await act(async () => {
      made = await result.current.createList('Snacks');
    });

    expect(made).toBeNull();
    await waitFor(() =>
      expect(listOf(result.current.lists, 'minted-1')).toBeUndefined(),
    );
  });

  it('switches a list with no version, so offline toggles replay in order', async () => {
    const update = recordMock(UpdateBrandListDocument, {
      data: { updateBrandList: null },
      partial: true,
    });
    const { result } = await renderLists(update);

    await act(async () => {
      await result.current.setEnabled('list-avoid', true);
    });

    expect(listOf(result.current.lists, 'list-avoid')?.enabled).toBe(true);
    expect(update.fired).toEqual([
      { input: { id: 'list-avoid', enabled: true } },
    ]);
  });

  it('puts a refused switch back', async () => {
    const { result } = await renderLists(
      recordMock(UpdateBrandListDocument, { data: refused('updateBrandList') }),
    );

    await act(async () => {
      await result.current.setEnabled('list-boycott', false);
    });

    await waitFor(() =>
      expect(listOf(result.current.lists, 'list-boycott')?.enabled).toBe(true),
    );
  });

  it('adds a brand at once under a minted entry id, and only once', async () => {
    const add = recordMock(AddBrandToListDocument, {
      data: { addBrandToList: null },
      partial: true,
    });
    const { result } = await renderLists(add);

    await act(async () => {
      await result.current.addBrand(
        'list-avoid',
        { id: 'brand-chips', name: 'ChipCo' },
        'too salty',
      );
    });

    expect(listOf(result.current.lists, 'list-avoid')?.brands).toEqual([
      {
        entryId: 'minted-1',
        brandId: 'brand-chips',
        name: 'ChipCo',
        reason: 'too salty',
      },
    ]);
    expect(add.fired).toEqual([
      {
        input: {
          id: 'minted-1',
          brandListId: 'list-avoid',
          brandId: 'brand-chips',
          reason: 'too salty',
        },
      },
    ]);

    // A brand the list already holds sends nothing.
    await act(async () => {
      await expect(
        result.current.addBrand(
          'list-boycott',
          { id: 'brand-soda', name: 'SodaCo' },
          null,
        ),
      ).resolves.toBe(true);
    });
    expect(add.fired).toHaveLength(1);
  });

  it('removes a brand at once, naming its entry', async () => {
    const remove = recordMock(RemoveBrandFromListDocument, {
      data: { removeBrandFromList: null },
      partial: true,
    });
    const { result } = await renderLists(remove);

    await act(async () => {
      await result.current.removeBrand('list-boycott', 'entry-soda');
    });

    expect(listOf(result.current.lists, 'list-boycott')?.brands).toEqual([]);
    expect(remove.fired).toEqual([{ input: { id: 'entry-soda' } }]);
  });

  it('deletes a list at once, and puts a refused one back where it was', async () => {
    const { result } = await renderLists(
      recordMock(DeleteBrandListDocument, { data: refused('deleteBrandList') }),
    );

    await act(async () => {
      await result.current.deleteList('list-boycott');
    });

    await waitFor(() =>
      expect(result.current.lists.map(list => list.id)).toEqual([
        'list-boycott',
        'list-avoid',
      ]),
    );
  });

  // The scan card mounts per scan: one read of the lists serves the next.
  it('asks once across scans when read cache-first', async () => {
    const cache = makeCache();
    const lists = listsMock();
    const mount = () =>
      renderHookWithApollo(
        () => useBrandLists({ fetchPolicy: 'cache-first' }),
        { cache, operationMocks: [lists.mock] },
      );

    const first = mount();
    await waitFor(() => expect(first.result.current.lists).toHaveLength(2));
    first.unmount();
    const second = mount();

    expect(second.result.current.lists).toHaveLength(2);
    expect(lists.fired).toHaveLength(1);
  });
});
