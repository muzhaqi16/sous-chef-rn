import { EntryImageSource } from '#/graphql/generated/schemaTypes';
import { entryGallery } from '#features/catalog/ui/entryGallery';
import { MAX_GALLERY_PHOTOS } from '#utils/imageUtils';

const photos = [{ id: 'front' }, { id: 'back' }, { id: 'label' }];

describe('entryGallery', () => {
  it('shows the item photos as they are when the entry shows the catalog photo', () => {
    expect(
      entryGallery(
        { url: 'https://cdn/front.jpg', source: EntryImageSource.Catalog },
        photos,
      ),
    ).toEqual({ leadImageUrl: null, photos });
  });

  it('leads with the household upload, before the item photos', () => {
    expect(
      entryGallery(
        {
          url: 'https://signed/own.jpg',
          source: EntryImageSource.Household,
          catalogImageId: null,
        },
        photos,
      ),
    ).toEqual({ leadImageUrl: 'https://signed/own.jpg', photos });
  });

  it('moves the item photo the household picked to the front', () => {
    expect(
      entryGallery(
        {
          url: 'https://cdn/label.jpg',
          source: EntryImageSource.Household,
          catalogImageId: 'label',
        },
        photos,
      ),
    ).toEqual({
      leadImageUrl: null,
      photos: [{ id: 'label' }, { id: 'front' }, { id: 'back' }],
    });
  });

  // The cap keeps one photo per perspective first, so a pick with none could
  // be dropped behind a full set of perspectives.
  it('keeps the picked photo when the item has more photos than the gallery shows', () => {
    const many = Array.from({ length: MAX_GALLERY_PHOTOS + 2 }, (_, i) => ({
      id: `p${i}`,
      perspective: `view-${i}`,
    }));
    const picked = { id: 'picked', perspective: null };

    const { photos: shown } = entryGallery(
      {
        url: 'https://cdn/picked.jpg',
        source: EntryImageSource.Household,
        catalogImageId: 'picked',
      },
      [...many, picked],
    );

    expect(shown[0]).toBe(picked);
    expect(shown).toHaveLength(MAX_GALLERY_PHOTOS);
  });

  it('still shows a picked photo this read does not list, by its url', () => {
    expect(
      entryGallery(
        {
          url: 'https://cdn/other.jpg',
          source: EntryImageSource.Household,
          catalogImageId: 'not-listed',
        },
        photos,
      ),
    ).toEqual({ leadImageUrl: 'https://cdn/other.jpg', photos });
  });

  it('has nothing to show with no photo and no item photos', () => {
    expect(entryGallery(null, null)).toEqual({
      leadImageUrl: null,
      photos: [],
    });
  });
});
