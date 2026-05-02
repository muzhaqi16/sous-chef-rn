'use no memo';

import {
  pickImageUrl,
  resolveImageUrl,
  getItemImageUrl,
  parseImages,
  hasImages,
  getBestImageUrl,
  getPrimaryImage,
  getPerspectiveLabel,
  groupImagesByPerspective,
} from '../imageUtils';
import type { ItemImage } from '#/types/nutrition';

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
  // parseImages
  // ==========================================================================
  describe('parseImages', () => {
    it('returns empty array for null', () => {
      expect(parseImages(null)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(parseImages(undefined)).toEqual([]);
    });

    it('returns empty array for non-array', () => {
      expect(parseImages('string')).toEqual([]);
      expect(parseImages(42)).toEqual([]);
      expect(parseImages({})).toEqual([]);
    });

    it('filters out invalid items without perspective', () => {
      const input = [
        { sizes: [{ size: 'small', url: 'http://a.com/a.jpg' }] },
        {
          perspective: 'front',
          sizes: [{ size: 'small', url: 'http://a.com/b.jpg' }],
          featured: false,
          sourcePriority: 1,
        },
      ];
      expect(parseImages(input)).toHaveLength(1);
    });

    it('filters out items without sizes array', () => {
      const input = [
        { perspective: 'front', sizes: 'not-array' },
        {
          perspective: 'back',
          sizes: [{ size: 'small', url: 'http://a.com/b.jpg' }],
          featured: false,
          sourcePriority: 1,
        },
      ];
      expect(parseImages(input)).toHaveLength(1);
    });

    it('filters out null items', () => {
      const input = [
        null,
        undefined,
        { perspective: 'front', sizes: [], featured: false, sourcePriority: 0 },
      ];
      expect(parseImages(input)).toHaveLength(1);
    });

    it('parses valid ItemImage array', () => {
      const input = [
        {
          perspective: 'front',
          sizes: [{ size: 'small', url: 'http://a.com/s.jpg' }],
          featured: true,
          sourcePriority: 1,
        },
        {
          perspective: 'back',
          sizes: [{ size: 'large', url: 'http://a.com/l.jpg' }],
          featured: false,
          sourcePriority: 2,
        },
      ];
      const result = parseImages(input);
      expect(result).toHaveLength(2);
      expect(result[0].perspective).toBe('front');
    });
  });

  // ==========================================================================
  // hasImages
  // ==========================================================================
  describe('hasImages', () => {
    it('returns false for empty array', () => {
      expect(hasImages([])).toBe(false);
    });

    it('returns false when all images have empty sizes', () => {
      const images: ItemImage[] = [
        { perspective: 'front', sizes: [], featured: false, sourcePriority: 0 },
      ];
      expect(hasImages(images)).toBe(false);
    });

    it('returns true when at least one image has sizes', () => {
      const images: ItemImage[] = [
        { perspective: 'front', sizes: [], featured: false, sourcePriority: 0 },
        {
          perspective: 'back',
          sizes: [{ size: 'small', url: 'http://a.com/b.jpg' }],
          featured: false,
          sourcePriority: 1,
        },
      ];
      expect(hasImages(images)).toBe(true);
    });
  });

  // ==========================================================================
  // getBestImageUrl
  // ==========================================================================
  describe('getBestImageUrl', () => {
    it('returns null for empty sizes', () => {
      const image: ItemImage = {
        perspective: 'front',
        sizes: [],
        featured: false,
        sourcePriority: 0,
      };
      expect(getBestImageUrl(image)).toBeNull();
    });

    it('returns preferred size when available', () => {
      const image: ItemImage = {
        perspective: 'front',
        featured: false,
        sourcePriority: 0,
        sizes: [
          { size: 'large', url: 'http://a.com/large.jpg' },
          { size: 'small', url: 'http://a.com/small.jpg' },
        ],
      };
      expect(getBestImageUrl(image, 'large')).toBe('http://a.com/large.jpg');
    });

    it('defaults to small size', () => {
      const image: ItemImage = {
        perspective: 'front',
        featured: false,
        sourcePriority: 0,
        sizes: [
          { size: 'small', url: 'http://a.com/small.jpg' },
          { size: 'large', url: 'http://a.com/large.jpg' },
        ],
      };
      expect(getBestImageUrl(image)).toBe('http://a.com/small.jpg');
    });

    it('falls back through SIZE_PRIORITY when preferred size is not available', () => {
      const image: ItemImage = {
        perspective: 'front',
        featured: false,
        sourcePriority: 0,
        sizes: [{ size: 'medium', url: 'http://a.com/medium.jpg' }],
      };
      // preferred 'xlarge' not found, falls through to 'small' (not found), then 'medium'
      expect(getBestImageUrl(image, 'xlarge')).toBe('http://a.com/medium.jpg');
    });

    it('returns first available as last resort', () => {
      const image: ItemImage = {
        perspective: 'front',
        featured: false,
        sourcePriority: 0,
        sizes: [{ size: 'thumbnail' as any, url: 'http://a.com/thumb.jpg' }],
      };
      // 'thumbnail' is in SIZE_PRIORITY so it should be found
      expect(getBestImageUrl(image, 'xlarge')).toBe('http://a.com/thumb.jpg');
    });
  });

  // ==========================================================================
  // getPrimaryImage
  // ==========================================================================
  describe('getPrimaryImage', () => {
    it('returns null for empty array', () => {
      expect(getPrimaryImage([])).toBeNull();
    });

    it('returns featured image first', () => {
      const images: ItemImage[] = [
        { perspective: 'back', sizes: [], featured: false, sourcePriority: 0 },
        { perspective: 'front', sizes: [], featured: true, sourcePriority: 1 },
      ];
      expect(getPrimaryImage(images)?.perspective).toBe('front');
    });

    it('returns front perspective when no featured image', () => {
      const images: ItemImage[] = [
        { perspective: 'back', sizes: [], featured: false, sourcePriority: 0 },
        { perspective: 'front', sizes: [], featured: false, sourcePriority: 1 },
      ];
      expect(getPrimaryImage(images)?.perspective).toBe('front');
    });

    it('returns first image as fallback', () => {
      const images: ItemImage[] = [
        { perspective: 'left', sizes: [], featured: false, sourcePriority: 0 },
        { perspective: 'right', sizes: [], featured: false, sourcePriority: 1 },
      ];
      expect(getPrimaryImage(images)?.perspective).toBe('left');
    });
  });

  // ==========================================================================
  // getPerspectiveLabel
  // ==========================================================================
  describe('getPerspectiveLabel', () => {
    it('returns known labels', () => {
      expect(getPerspectiveLabel('front')).toBe('Front');
      expect(getPerspectiveLabel('back')).toBe('Back');
      expect(getPerspectiveLabel('left')).toBe('Left');
      expect(getPerspectiveLabel('right')).toBe('Right');
      expect(getPerspectiveLabel('nutrition_label')).toBe('Nutrition');
      expect(getPerspectiveLabel('ingredient_list')).toBe('Ingredients');
    });

    it('capitalizes unknown perspectives', () => {
      expect(getPerspectiveLabel('custom')).toBe('Custom');
      expect(getPerspectiveLabel('topDown')).toBe('TopDown');
    });
  });

  // ==========================================================================
  // groupImagesByPerspective
  // ==========================================================================
  describe('groupImagesByPerspective', () => {
    it('returns empty array for empty input', () => {
      expect(groupImagesByPerspective([])).toEqual([]);
    });

    it('groups images by perspective', () => {
      const images: ItemImage[] = [
        { perspective: 'front', sizes: [], featured: true, sourcePriority: 0 },
        { perspective: 'front', sizes: [], featured: false, sourcePriority: 1 },
        { perspective: 'back', sizes: [], featured: false, sourcePriority: 0 },
      ];
      const result = groupImagesByPerspective(images);
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('front');
      expect(result[0].images).toHaveLength(2);
      expect(result[1].key).toBe('back');
      expect(result[1].images).toHaveLength(1);
    });

    it('sorts by perspective order', () => {
      const images: ItemImage[] = [
        {
          perspective: 'nutrition_label',
          sizes: [],
          featured: false,
          sourcePriority: 0,
        },
        { perspective: 'front', sizes: [], featured: false, sourcePriority: 0 },
        { perspective: 'back', sizes: [], featured: false, sourcePriority: 0 },
      ];
      const result = groupImagesByPerspective(images);
      expect(result.map(t => t.key)).toEqual([
        'front',
        'back',
        'nutrition_label',
      ]);
    });

    it('places unknown perspectives at the end', () => {
      const images: ItemImage[] = [
        {
          perspective: 'custom',
          sizes: [],
          featured: false,
          sourcePriority: 0,
        },
        { perspective: 'front', sizes: [], featured: false, sourcePriority: 0 },
      ];
      const result = groupImagesByPerspective(images);
      expect(result[0].key).toBe('front');
      expect(result[1].key).toBe('custom');
    });

    it('includes correct labels', () => {
      const images: ItemImage[] = [
        {
          perspective: 'ingredient_list',
          sizes: [],
          featured: false,
          sourcePriority: 0,
        },
      ];
      const result = groupImagesByPerspective(images);
      expect(result[0].label).toBe('Ingredients');
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

    it('falls back to legacy images parsing', () => {
      const item = {
        images: [
          {
            perspective: 'front',
            featured: true,
            sourcePriority: 1,
            sizes: [
              { size: 'small', url: 'https://cdn.example.com/front-small.jpg' },
            ],
          },
        ],
      };
      // When kind lookup fails (images are ItemImage[], not ImageVariant[]),
      // it falls through to the legacy path
      expect(getItemImageUrl(item, 'small')).toBe(
        'https://cdn.example.com/front-small.jpg',
      );
    });

    it('returns null when no valid source exists', () => {
      const item = { images: [] };
      expect(getItemImageUrl(item)).toBeNull();
    });

    it('uses medium kind for large preferred size', () => {
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

    it('resolves from own images via legacy path', () => {
      const source = {
        images: [
          {
            perspective: 'front',
            featured: true,
            sourcePriority: 1,
            sizes: [
              { size: 'small', url: 'https://cdn.example.com/legacy.jpg' },
            ],
          },
        ],
      };
      // No kind match for xlarge in PREFERRED_SIZE_TO_KIND
      expect(resolveImageUrl(source, 'xlarge')).toBe(
        'https://cdn.example.com/legacy.jpg',
      );
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
