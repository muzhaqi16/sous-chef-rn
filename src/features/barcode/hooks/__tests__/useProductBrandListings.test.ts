import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { ProductBrandListingsDocument } from '../useProductBrandListings.generated';
import type { BrandListView } from '#features/profile/hooks/useBrandLists';
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

const entry = (entryId: string, brandId: string, reason: string | null) => ({
  entryId,
  brandId,
  name: brandId,
  reason,
});

const list = (
  id: string,
  name: string,
  enabled: boolean,
  brands: ReturnType<typeof entry>[],
): BrandListView => ({ id, name, enabled, brands });

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
    // The user's lists not read yet: the matches stand as the item carries them.
    const { result } = renderHookWithApollo(
      () => useProductBrandListings('jif-creamy', 'b-jif', null),
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

  it('shows a list holding the scanned brand before the matches are read again', () => {
    const { result } = renderHookWithApollo(
      () =>
        useProductBrandListings('jif-creamy', 'b-jif', [
          list('l-avoid', 'Avoid', true, [
            entry('e-local', 'b-jif', 'too sweet'),
          ]),
          list('l-off', 'Off', false, [entry('e-off', 'b-jif', null)]),
          list('l-other', 'Other', true, [entry('e-x', 'b-skippy', null)]),
        ]),
      { operationMocks: [] },
    );

    expect(result.current.listings).toEqual([
      {
        key: 'l-avoid:e-local',
        listName: 'Avoid',
        viaParent: null,
        reason: 'too sweet',
      },
    ]);
  });

  it("takes the list's own entry for the brand over a match through its parent", async () => {
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
          ],
        },
      },
    });
    const { result } = renderHookWithApollo(
      () =>
        useProductBrandListings('jif-creamy', 'b-jif', [
          list('l-boycott', 'Boycott', true, [
            entry('e-1', 'b-Smucker', 'parent company'),
            entry('e-2', 'b-jif', null),
          ]),
        ]),
      { operationMocks: [mock.mock] },
    );

    await waitFor(() => expect(mock.fired).toHaveLength(1));
    expect(result.current.listings).toEqual([
      {
        key: 'l-boycott:e-2',
        listName: 'Boycott',
        viaParent: null,
        reason: null,
      },
    ]);
  });

  // The user sees the match, then changes the list from the scan result.
  describe('once the user has changed their lists', () => {
    const avoidMatch = () =>
      recordMock(ProductBrandListingsDocument, {
        data: {
          item: {
            id: 'jif-creamy',
            listMatches: [
              match(
                { id: 'l-avoid', name: 'Avoid', enabled: true },
                { id: 'e-2', reason: null, brand: 'Jif' },
                false,
              ),
            ],
          },
        },
      });
    const AVOID_HOLDING_JIF = list('l-avoid', 'Avoid', true, [
      entry('e-2', 'b-jif', null),
    ]);

    // Scanned as a Skippy record, so only the item's match can name Avoid.
    const renderListings = (lists: BrandListView[] | null) => {
      const mock = avoidMatch();
      const hook = renderHookWithApollo(
        (props: { lists: BrandListView[] | null }) =>
          useProductBrandListings('jif-creamy', 'b-skippy', props.lists),
        { operationMocks: [mock.mock], initialProps: { lists } },
      );
      return hook;
    };

    it('drops a match on a list the user deleted', async () => {
      const { result, rerender } = renderListings(null);
      await waitFor(() => expect(result.current.listings).toHaveLength(1));

      rerender({ lists: [] });

      expect(result.current.listings).toEqual([]);
    });

    it('drops a match whose brand the user took off the list', async () => {
      const { result, rerender } = renderListings([AVOID_HOLDING_JIF]);
      await waitFor(() => expect(result.current.listings).toHaveLength(1));

      rerender({
        lists: [
          list('l-avoid', 'Avoid', true, [entry('e-9', 'b-nutella', null)]),
        ],
      });

      expect(result.current.listings).toEqual([]);
    });

    it('keeps a match the list still holds', async () => {
      const { result } = renderListings([AVOID_HOLDING_JIF]);

      await waitFor(() => expect(result.current.listings).toHaveLength(1));
      expect(result.current.listings).toEqual([
        {
          key: 'l-avoid:e-2',
          listName: 'Avoid',
          viaParent: null,
          reason: null,
        },
      ]);
    });
  });
});
