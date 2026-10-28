import { act } from '@testing-library/react-native';
import { t } from '#/i18n';
import {
  EntryImageSource,
  ItemImageStatus,
} from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import type { ItemPhotoCarousel_ItemPhotoFragment } from '#features/catalog/ui/ItemPhotoCarousel.generated';
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

const photo = (
  id: string,
  status: ItemImageStatus,
): ItemPhotoCarousel_ItemPhotoFragment => ({
  __typename: 'ItemPhoto',
  id,
  url: `https://cdn.test/${id}.jpg`,
  perspective: 'front',
  isPrimary: false,
  status,
  credit: null,
  variants: [],
});

const NO_GALLERY = { leadImageUrl: null, photos: [] };

type Args = Parameters<typeof useReportPhotoHeaderAction>;

const render = (item: Args[0], image: Args[1], gallery: Args[2] = NO_GALLERY) =>
  renderHookWithApollo(() =>
    useReportPhotoHeaderAction(item, image, gallery, 'report-photo'),
  ).result;

const actions = (item: Args[0], image: Args[1], gallery?: Args[2]) =>
  render(item, image, gallery).current.actions;

beforeEach(() => {
  mockReportWrongPhoto.mockClear();
  jest.mocked(alertService.alert).mockClear();
});

describe('useReportPhotoHeaderAction', () => {
  it('reports the catalog photo the entry shows, by its id', () => {
    const [report] = actions(PUBLIC_ITEM, {
      source: EntryImageSource.Catalog,
      catalogImageId: 'photo-primary',
    });

    report?.onPress();

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

    report?.onPress();

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

    report?.onPress();

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

  // The API returns a PENDING photo to its submitter alone: the flag says so,
  // since the photo itself carries no label.
  describe('on the user’s own photo awaiting review', () => {
    const pendingFirst = {
      leadImageUrl: null,
      photos: [
        photo('mine', ItemImageStatus.Pending),
        photo('approved', ItemImageStatus.Approved),
      ],
    };

    it('marks the flag and explains instead of reporting', () => {
      const [flag] = actions(PUBLIC_ITEM, null, pendingFirst);

      expect(flag).toMatchObject({
        icon: 'flag-outline',
        mark: 'time-outline',
        accessibilityLabel: t('itemPhotos.pendingReviewAction'),
      });
      flag?.onPress();
      expect(alertService.alert).toHaveBeenCalledWith(
        t('itemPhotos.pendingReview'),
        t('itemPhotos.pendingReviewBody'),
      );
      expect(mockReportWrongPhoto).not.toHaveBeenCalled();
    });

    it('marks it where no report is offered', () => {
      const [flag] = actions(
        { ...PUBLIC_ITEM, canSuggest: false, imageUrl: null },
        null,
        pendingFirst,
      );

      expect(flag?.mark).toBe('time-outline');
    });

    it('follows the photo on screen', () => {
      const result = render(PUBLIC_ITEM, null, pendingFirst);
      expect(result.current.actions[0]?.mark).toBe('time-outline');

      act(() => result.current.onPageChange(1));

      expect(result.current.actions[0]?.mark).toBeUndefined();
      result.current.actions[0]?.onPress();
      expect(mockReportWrongPhoto).toHaveBeenCalledWith('item-1', 'approved');
    });
  });

  describe('over a gallery of photos', () => {
    const three = {
      leadImageUrl: null,
      photos: [
        photo('front', ItemImageStatus.Approved),
        photo('side', ItemImageStatus.Approved),
        photo('back', ItemImageStatus.Approved),
      ],
    };

    // Not the entry's lead photo: the one the user swiped to and called wrong.
    it('reports the photo on the page shown', () => {
      const result = render(
        PUBLIC_ITEM,
        { source: EntryImageSource.Catalog, catalogImageId: 'front' },
        three,
      );

      act(() => result.current.onPageChange(2));
      result.current.actions[0]?.onPress();

      expect(mockReportWrongPhoto).toHaveBeenCalledWith('item-1', 'back');
    });

    it('reports the first photo on the first page', () => {
      const [report] = actions(PUBLIC_ITEM, null, three);

      report?.onPress();

      expect(mockReportWrongPhoto).toHaveBeenCalledWith('item-1', 'front');
    });

    it("offers nothing over the household's own leading upload, and reports the page after it", () => {
      const result = render(
        PUBLIC_ITEM,
        { source: EntryImageSource.Household, catalogImageId: null },
        { ...three, leadImageUrl: 'https://cdn.test/household.jpg' },
      );
      expect(result.current.actions).toEqual([]);

      act(() => result.current.onPageChange(1));
      result.current.actions[0]?.onPress();

      expect(mockReportWrongPhoto).toHaveBeenCalledWith('item-1', 'front');
    });
  });
});
