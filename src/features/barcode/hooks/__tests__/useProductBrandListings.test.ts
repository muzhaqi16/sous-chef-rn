import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { ProductBrandListingsDocument } from '../useProductBrandListings.generated';
import { useProductBrandListings } from '../useProductBrandListings';

const match = (
  list: { id: string; name: string; enabled: boolean },
  entry: { id: string; reason: string | null; brand: string },
  viaParent: boolean,
) => ({
  brandList: list,
  entry: {
    id: entry.id,
    reason: entry.reason,
    brand: { id: `b-${entry.brand}`, name: entry.brand },
  },
  brand: { id: 'b-jif', name: 'Jif' },
  viaParent,
});

describe('useProductBrandListings', () => {
  it("names each switched-on list, the parent it went through, and the user's note", async () => {
    const mock = recordMock(ProductBrandListingsDocument, {
      data: {
        item: {
          id: 'jif-creamy',
          listMatches: [
            match(
              { id: 'l-boycott', name: 'Boycott', enabled: true },
              { id: 'e-1', reason: 'parent company', brand: 'Smucker' },
              true,
            ),
            match(
              { id: 'l-avoid', name: 'Avoid', enabled: true },
              { id: 'e-2', reason: null, brand: 'Jif' },
              false,
            ),
            // Switched off on this device since the matches were read.
            match(
              { id: 'l-old', name: 'Old', enabled: false },
              { id: 'e-3', reason: null, brand: 'Jif' },
              false,
            ),
          ],
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useProductBrandListings('jif-creamy'),
      { operationMocks: [mock.mock] },
    );

    await waitFor(() => expect(result.current.listings).toHaveLength(2));
    expect(result.current.listings).toEqual([
      {
        key: 'l-boycott:e-1',
        listName: 'Boycott',
        viaParent: 'Smucker',
        reason: 'parent company',
      },
      { key: 'l-avoid:e-2', listName: 'Avoid', viaParent: null, reason: null },
    ]);
  });
});
