import { renderHook } from '@testing-library/react-native';
import { EntryImageSource } from '#/graphql/generated/schemaTypes';
import { useReportPhotoHeaderAction } from '../useReportPhotoHeaderAction';

const mockReportWrongPhoto = jest.fn();
jest.mock('#features/catalog/hooks/useReportWrongPhoto', () => ({
  useReportWrongPhoto: () => ({
    reportWrongPhoto: (...args: unknown[]) => mockReportWrongPhoto(...args),
    loading: false,
  }),
}));

const PUBLIC_ITEM = {
  id: 'item-1',
  canSuggest: true,
  imageUrl: 'https://cdn.test/primary.jpg',
};

const actions = (
  item: Parameters<typeof useReportPhotoHeaderAction>[0],
  image: Parameters<typeof useReportPhotoHeaderAction>[1],
) =>
  renderHook(() => useReportPhotoHeaderAction(item, image, 'report-photo'))
    .result.current;

beforeEach(() => {
  mockReportWrongPhoto.mockClear();
});

describe('useReportPhotoHeaderAction', () => {
  it('reports the catalog photo the entry shows, by its id', () => {
    const [report] = actions(PUBLIC_ITEM, {
      source: EntryImageSource.Catalog,
      catalogImageId: 'photo-primary',
    });

    report?.onPress?.();

    expect(mockReportWrongPhoto).toHaveBeenCalledWith(
      'item-1',
      'photo-primary',
    );
  });

  // A pick is still a catalog photo, so it stays reviewable.
  it('reports a catalog photo the household picked, by the picked id', () => {
    const [report] = actions(PUBLIC_ITEM, {
      source: EntryImageSource.Household,
      catalogImageId: 'photo-side',
    });

    report?.onPress?.();

    expect(mockReportWrongPhoto).toHaveBeenCalledWith('item-1', 'photo-side');
  });

  it("offers nothing over the household's own upload", () => {
    expect(
      actions(PUBLIC_ITEM, {
        source: EntryImageSource.Household,
        catalogImageId: null,
      }),
    ).toEqual([]);
  });

  it('reports the approved main photo when the read names no photo', () => {
    const [report] = actions(PUBLIC_ITEM, null);

    report?.onPress?.();

    expect(mockReportWrongPhoto).toHaveBeenCalledWith('item-1', undefined);
  });

  it('offers nothing with no photo to report', () => {
    expect(actions({ ...PUBLIC_ITEM, imageUrl: null }, null)).toEqual([]);
  });

  it("offers nothing for an item the household can't suggest changes to", () => {
    expect(
      actions(
        { ...PUBLIC_ITEM, canSuggest: false },
        { source: EntryImageSource.Catalog, catalogImageId: 'photo-primary' },
      ),
    ).toEqual([]);
  });
});
