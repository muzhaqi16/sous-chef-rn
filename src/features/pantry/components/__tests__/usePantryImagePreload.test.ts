import { waitFor } from '@testing-library/react-native';
import { requirePlatform } from '#platform/install';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { EntryImageSource } from '#/graphql/generated/schemaTypes';
import type { PantryListNode } from '#features/pantry/components/pantryDisplay/renderItem';
import { usePantryImagePreload } from '../usePantryImagePreload';

const prefetch = jest
  .spyOn(requirePlatform('imagePrefetch'), 'prefetch')
  .mockImplementation(() => {});

const CATALOG = 'https://cdn.example.com/catalog/bananas.jpg';
const HOUSEHOLD = 'https://cdn.example.com/household/bananas.jpg';

const stack = (image: object | null) => ({
  __typename: 'PantryItem',
  id: 'stack-1',
  image,
  item: {
    __typename: 'Item',
    id: 'bananas',
    imageUrl: CATALOG,
    images: [],
  },
});

const NODES = [
  { __typename: 'PantryItem', id: 'stack-1' },
] as unknown as PantryListNode[];

beforeEach(() => {
  prefetch.mockClear();
});

describe('usePantryImagePreload', () => {
  // The row leads with the household's photo, so that is the one to warm.
  it("warms the household's photo over the catalog's", async () => {
    const cache = seedCache([
      stack({
        __typename: 'EntryImage',
        url: HOUSEHOLD,
        source: EntryImageSource.Household,
        catalogImageId: null,
      }),
    ]);

    renderHookWithApollo(() => usePantryImagePreload(NODES), { cache });

    await waitFor(() => expect(prefetch).toHaveBeenCalledWith([HOUSEHOLD]));
  });

  it("warms the catalog's photo when the household chose none", async () => {
    const cache = seedCache([stack(null)]);

    renderHookWithApollo(() => usePantryImagePreload(NODES), { cache });

    await waitFor(() => expect(prefetch).toHaveBeenCalledWith([CATALOG]));
  });
});
