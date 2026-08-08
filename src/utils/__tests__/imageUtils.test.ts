'use no memo';

import {
  pickImageUrl,
  resolveImageUrl,
  getItemImageUrl,
  getPerspectiveLabel,
  photoDisplayUrl,
  galleryPhotos,
  toImagePerspective,
  MAX_GALLERY_PHOTOS,
} from '../imageUtils';
import { ImagePerspective } from '#/graphql/generated/schemaTypes';

describe('imageUtils', () => {
  // ==========================================================================
  // pickImageUrl
  // ==========================================================================
  describe('pickImageUrl', () => {
    it('returns null for null images', () => {
      expect(pickImageUrl(null, 'THUMBNAIL')).toBeNull();
    });

    it('returns null for undefined images', () => {
      expect(pickImageUrl(undefined, 'THUMBNAIL')).toBeNull();
    });

    it('returns null for empty array', () => {
      expect(pickImageUrl([], 'THUMBNAIL')).toBeNull();
    });

    it('returns matching kind url', () => {
      const images = [
        { url: 'https://cdn.example.com/thumb.jpg', kind: 'THUMBNAIL' },
        { url: 'https://cdn.example.com/main.jpg', kind: 'MAIN' },
      ];
      expect(pickImageUrl(images, 'THUMBNAIL')).toBe(
        'https://cdn.example.com/thumb.jpg',
      );
    });

    it('falls back to MAIN kind when preferred kind is missing', () => {
      const images = [
        { url: 'https://cdn.example.com/main.jpg', kind: 'MAIN' },
        { url: 'https://cdn.example.com/other.jpg', kind: 'OTHER' },
      ];
      expect(pickImageUrl(images, 'THUMBNAIL')).toBe(
        'https://cdn.example.com/main.jpg',
      );
    });

    it('returns null when neither preferred kind nor MAIN exists', () => {
      const images = [
        { url: 'https://cdn.example.com/other.jpg', kind: 'OTHER' },
      ];
      expect(pickImageUrl(images, 'THUMBNAIL')).toBeNull();
    });

    it('handles images with null kind', () => {
      const images = [{ url: 'https://cdn.example.com/a.jpg', kind: null }];
      expect(pickImageUrl(images, 'THUMBNAIL')).toBeNull();
    });
  });

  // ==========================================================================
  // photoDisplayUrl
  // ==========================================================================
  describe('photoDisplayUrl', () => {
    it('prefers the SIZE_512 rendition at large', () => {
      const photo = {
        url: 'https://cdn.example.com/original.jpg',
        variants: [
          { url: 'https://cdn.example.com/thumb.jpg', kind: 'THUMBNAIL' },
          { url: 'https://cdn.example.com/512.jpg', kind: 'SIZE_512' },
        ],
      };
      expect(photoDisplayUrl(photo, 'large')).toBe(
        'https://cdn.example.com/512.jpg',
      );
    });

    it('prefers the THUMBNAIL rendition at small', () => {
      const photo = {
        url: 'https://cdn.example.com/original.jpg',
        variants: [
          { url: 'https://cdn.example.com/thumb.jpg', kind: 'THUMBNAIL' },
          { url: 'https://cdn.example.com/512.jpg', kind: 'SIZE_512' },
        ],
      };
      expect(photoDisplayUrl(photo, 'small')).toBe(
        'https://cdn.example.com/thumb.jpg',
      );
    });

    // Renditions are generated asynchronously; a photo uploaded seconds ago has
    // none, and must still render rather than showing a broken frame.
    it('falls back to the original when renditions are missing', () => {
      const photo = {
        url: 'https://cdn.example.com/original.jpg',
        variants: [],
      };
      expect(photoDisplayUrl(photo, 'large')).toBe(
        'https://cdn.example.com/original.jpg',
      );
    });

    it('falls back to the original when the requested size has no rendition', () => {
      const photo = {
        url: 'https://cdn.example.com/original.jpg',
        variants: [
          { url: 'https://cdn.example.com/thumb.jpg', kind: 'THUMBNAIL' },
        ],
      };
      expect(photoDisplayUrl(photo, 'xlarge')).toBe(
        'https://cdn.example.com/original.jpg',
      );
    });
  });

  // ==========================================================================
  // galleryPhotos
  // ==========================================================================
  describe('galleryPhotos', () => {
    it('returns empty for null/undefined/empty', () => {
      expect(galleryPhotos(null)).toEqual([]);
      expect(galleryPhotos(undefined)).toEqual([]);
      expect(galleryPhotos([])).toEqual([]);
    });

    // The server's ordering is the contract — re-sorting locally would fight it.
    it('preserves server order', () => {
      const photos = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];
      expect(galleryPhotos(photos).map(p => p.id)).toEqual(['c', 'a', 'b']);
    });

    it('caps at MAX_GALLERY_PHOTOS', () => {
      const photos = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }));
      expect(galleryPhotos(photos)).toHaveLength(MAX_GALLERY_PHOTOS);
    });

    // `Item.photos` puts featured photos — any perspective, unbounded — ahead of
    // the perspective run, so a plain slice drops the label shots on a catalog
    // item with lots of provider imagery. Those are the whole point of the
    // fullscreen viewer.
    it('keeps each perspective when featured photos would crowd them out', () => {
      const featured = Array.from({ length: 10 }, (_, i) => ({
        id: `featured-${i}`,
        perspective: null,
      }));
      const photos = [
        ...featured,
        { id: 'front', perspective: 'front' },
        { id: 'nutrition', perspective: 'nutrition_label' },
        { id: 'ingredients', perspective: 'ingredient_list' },
      ];

      const ids = galleryPhotos(photos).map(p => p.id);
      expect(ids).toContain('front');
      expect(ids).toContain('nutrition');
      expect(ids).toContain('ingredients');
      expect(ids).toHaveLength(MAX_GALLERY_PHOTOS);
    });

    it('returns survivors in server order, not selection order', () => {
      const photos = [
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `f${i}`,
          perspective: null,
        })),
        { id: 'nutrition', perspective: 'nutrition_label' },
      ];

      const ids = galleryPhotos(photos).map(p => p.id);
      // The reserved photo is last in the source, so it must stay last.
      expect(ids[ids.length - 1]).toBe('nutrition');
    });

    it('keeps only the first photo of a repeated perspective', () => {
      const photos = [
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `f${i}`,
          perspective: null,
        })),
        { id: 'front-a', perspective: 'front' },
        { id: 'front-b', perspective: 'front' },
      ];

      const ids = galleryPhotos(photos).map(p => p.id);
      expect(ids).toContain('front-a');
      expect(ids).not.toContain('front-b');
    });
  });

  // ==========================================================================
  // toImagePerspective
  // ==========================================================================
  describe('toImagePerspective', () => {
    it('maps every capture perspective to its enum member', () => {
      expect(toImagePerspective('front')).toBe(ImagePerspective.Front);
      expect(toImagePerspective('back')).toBe(ImagePerspective.Back);
      expect(toImagePerspective('left')).toBe(ImagePerspective.Left);
      expect(toImagePerspective('right')).toBe(ImagePerspective.Right);
      expect(toImagePerspective('top')).toBe(ImagePerspective.Top);
      expect(toImagePerspective('nutrition_label')).toBe(
        ImagePerspective.NutritionLabel,
      );
      expect(toImagePerspective('ingredient_list')).toBe(
        ImagePerspective.IngredientList,
      );
    });

    it('is case-insensitive', () => {
      expect(toImagePerspective('FRONT')).toBe(ImagePerspective.Front);
    });

    // Undefined (not a throw) so an unrecognised angle uploads untagged rather
    // than failing input validation and losing the photo.
    it('returns undefined for unknown or empty values', () => {
      expect(toImagePerspective('sideways')).toBeUndefined();
      expect(toImagePerspective('')).toBeUndefined();
      expect(toImagePerspective(null)).toBeUndefined();
      expect(toImagePerspective(undefined)).toBeUndefined();
    });
  });

  // ==========================================================================
  // getPerspectiveLabel
  // ==========================================================================
  describe('getPerspectiveLabel', () => {
    // Stand-in for i18next: returns the key so the test can assert which one was
    // asked for, and honours `defaultValue` the way i18next does for a miss.
    const translate = (key: string) => key;

    it('looks the label up under itemPhotos.perspective', () => {
      expect(getPerspectiveLabel('front', translate)).toBe(
        'itemPhotos.perspective.front',
      );
      expect(getPerspectiveLabel('nutrition_label', translate)).toBe(
        'itemPhotos.perspective.nutrition_label',
      );
    });

    // A provider can supply a perspective outside our set; a capitalized raw
    // value beats showing a missing-key marker.
    it('falls back to the capitalized raw value for an unknown perspective', () => {
      const missing = (_key: string, options?: Record<string, unknown>) =>
        String(options?.defaultValue ?? '');
      expect(getPerspectiveLabel('custom', missing)).toBe('Custom');
      expect(getPerspectiveLabel('topDown', missing)).toBe('TopDown');
    });
  });

  // ==========================================================================
  // getItemImageUrl
  // ==========================================================================
  describe('getItemImageUrl', () => {
    it('returns null for null item', () => {
      expect(getItemImageUrl(null)).toBeNull();
    });

    it('returns null for undefined item', () => {
      expect(getItemImageUrl(undefined)).toBeNull();
    });

    it('returns imageUrl when valid URL', () => {
      const item = { imageUrl: 'https://cdn.example.com/image.jpg' };
      expect(getItemImageUrl(item)).toBe('https://cdn.example.com/image.jpg');
    });

    it('returns imageUrl with http protocol', () => {
      const item = { imageUrl: 'http://cdn.example.com/image.jpg' };
      expect(getItemImageUrl(item)).toBe('http://cdn.example.com/image.jpg');
    });

    it('returns null for invalid imageUrl (just filename)', () => {
      const item = { imageUrl: 'image.jpg' };
      expect(getItemImageUrl(item)).toBeNull();
    });

    it('prefers API-generated variants over imageUrl', () => {
      const item = {
        imageUrl: 'https://cdn.example.com/original.jpg',
        images: [
          { url: 'https://cdn.example.com/thumb.jpg', kind: 'THUMBNAIL' },
          { url: 'https://cdn.example.com/main.jpg', kind: 'MAIN' },
        ],
      };
      // 'small' maps to kind 'THUMBNAIL'
      expect(getItemImageUrl(item, 'small')).toBe(
        'https://cdn.example.com/thumb.jpg',
      );
    });

    it('returns null when no valid source exists', () => {
      const item = { images: [] };
      expect(getItemImageUrl(item)).toBeNull();
    });

    it('uses SIZE_512 kind for large preferred size', () => {
      const item = {
        images: [{ url: 'https://cdn.example.com/512.jpg', kind: 'SIZE_512' }],
      };
      expect(getItemImageUrl(item, 'large')).toBe(
        'https://cdn.example.com/512.jpg',
      );
    });
  });

  // ==========================================================================
  // resolveImageUrl
  // ==========================================================================
  describe('resolveImageUrl', () => {
    it('returns null for null source', () => {
      expect(resolveImageUrl(null)).toBeNull();
    });

    it('returns null for undefined source', () => {
      expect(resolveImageUrl(undefined)).toBeNull();
    });

    it('resolves from nested item.images variants first', () => {
      const source = {
        item: {
          images: [
            { url: 'https://cdn.example.com/thumb.jpg', kind: 'THUMBNAIL' },
          ],
        },
      };
      expect(resolveImageUrl(source, 'small')).toBe(
        'https://cdn.example.com/thumb.jpg',
      );
    });

    it('resolves from own images variants second', () => {
      const source = {
        images: [{ url: 'https://cdn.example.com/512.jpg', kind: 'SIZE_512' }],
      };
      expect(resolveImageUrl(source, 'medium')).toBe(
        'https://cdn.example.com/512.jpg',
      );
    });

    it('resolves from own imageUrl third', () => {
      const source = {
        imageUrl: 'https://cdn.example.com/own.jpg',
      };
      expect(resolveImageUrl(source)).toBe('https://cdn.example.com/own.jpg');
    });

    it('does not return non-URL imageUrl', () => {
      const source = {
        imageUrl: 'just-a-filename.jpg',
        item: { imageUrl: 'https://cdn.example.com/nested.jpg' },
      };
      expect(resolveImageUrl(source)).toBe(
        'https://cdn.example.com/nested.jpg',
      );
    });

    it('resolves from nested item as fallback', () => {
      const source = {
        item: {
          imageUrl: 'https://cdn.example.com/item.jpg',
        },
      };
      expect(resolveImageUrl(source)).toBe('https://cdn.example.com/item.jpg');
    });

    it('returns null when nothing matches', () => {
      const source = {};
      expect(resolveImageUrl(source)).toBeNull();
    });

    it('defaults to small preferred size', () => {
      const source = {
        images: [
          { url: 'https://cdn.example.com/thumb.jpg', kind: 'THUMBNAIL' },
        ],
      };
      // 'small' maps to THUMBNAIL
      expect(resolveImageUrl(source)).toBe('https://cdn.example.com/thumb.jpg');
    });
  });
});
