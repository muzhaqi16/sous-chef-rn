import { EntryImageSource } from '#/graphql/generated/schemaTypes';
import { entryGallery } from '#features/catalog/ui/entryGallery';

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
