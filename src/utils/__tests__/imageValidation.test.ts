import {
  validateImageFile,
  getMimeTypeFromUri,
  createImageValidationError,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  MAX_PROFILE_SIZE,
  ImageValidationError,
} from '../imageValidation';

describe('validateImageFile', () => {
  describe('valid files', () => {
    it('accepts JPEG', () => {
      expect(() =>
        validateImageFile({ type: 'image/jpeg', size: 1000 }),
      ).not.toThrow();
    });

    it('accepts PNG', () => {
      expect(() =>
        validateImageFile({ type: 'image/png', size: 1000 }),
      ).not.toThrow();
    });

    it('accepts WebP', () => {
      expect(() =>
        validateImageFile({ type: 'image/webp', size: 1000 }),
      ).not.toThrow();
    });

    it('accepts image/jpg', () => {
      expect(() =>
        validateImageFile({ type: 'image/jpg', size: 1000 }),
      ).not.toThrow();
    });

    it('accepts fileSize (react-native-image-picker)', () => {
      expect(() =>
        validateImageFile({ type: 'image/jpeg', fileSize: 1000 }),
      ).not.toThrow();
    });
  });

  describe('type validation', () => {
    it('rejects unsupported MIME type', () => {
      expect(() =>
        validateImageFile({ type: 'image/gif', size: 1000 }),
      ).toThrow('Only JPEG, PNG, and WebP images are allowed');
    });

    it('rejects when no type and no fileName', () => {
      expect(() => validateImageFile({ size: 1000 })).toThrow();
    });

    it('infers MIME from fileName when type is missing', () => {
      expect(() =>
        validateImageFile({ fileName: 'photo.jpg', size: 1000 }),
      ).not.toThrow();
    });

    it('infers PNG from fileName', () => {
      expect(() =>
        validateImageFile({ fileName: 'photo.png', size: 1000 }),
      ).not.toThrow();
    });

    it('infers WebP from fileName', () => {
      expect(() =>
        validateImageFile({ fileName: 'photo.webp', size: 1000 }),
      ).not.toThrow();
    });

    it('rejects unsupported extension in fileName', () => {
      expect(() =>
        validateImageFile({ fileName: 'photo.bmp', size: 1000 }),
      ).toThrow();
    });

    it('has INVALID_TYPE error code', () => {
      try {
        validateImageFile({ type: 'image/gif', size: 1000 });
      } catch (e) {
        expect((e as ImageValidationError).code).toBe('INVALID_TYPE');
      }
    });
  });

  describe('size validation', () => {
    it('accepts file at max image size', () => {
      expect(() =>
        validateImageFile({ type: 'image/jpeg', size: MAX_IMAGE_SIZE }),
      ).not.toThrow();
    });

    it('rejects file exceeding max image size', () => {
      expect(() =>
        validateImageFile({ type: 'image/jpeg', size: MAX_IMAGE_SIZE + 1 }),
      ).toThrow('File too large');
    });

    it('uses profile size limit when isProfile is true', () => {
      expect(() =>
        validateImageFile(
          { type: 'image/jpeg', size: MAX_PROFILE_SIZE + 1 },
          true,
        ),
      ).toThrow('File too large');
    });

    it('accepts profile within profile limit', () => {
      expect(() =>
        validateImageFile({ type: 'image/jpeg', size: MAX_PROFILE_SIZE }, true),
      ).not.toThrow();
    });

    it('has FILE_TOO_LARGE error code', () => {
      try {
        validateImageFile({ type: 'image/jpeg', size: MAX_IMAGE_SIZE + 1 });
      } catch (e) {
        expect((e as ImageValidationError).code).toBe('FILE_TOO_LARGE');
      }
    });

    it('throws UNKNOWN_ERROR when size is missing', () => {
      try {
        validateImageFile({ type: 'image/jpeg' });
      } catch (e) {
        expect((e as ImageValidationError).code).toBe('UNKNOWN_ERROR');
      }
    });
  });
});

describe('getMimeTypeFromUri', () => {
  it('returns image/jpeg for .jpg', () => {
    expect(getMimeTypeFromUri('file:///photo.jpg')).toBe('image/jpeg');
  });

  it('returns image/jpeg for .jpeg', () => {
    expect(getMimeTypeFromUri('file:///photo.jpeg')).toBe('image/jpeg');
  });

  it('returns image/png for .png', () => {
    expect(getMimeTypeFromUri('file:///photo.png')).toBe('image/png');
  });

  it('returns image/webp for .webp', () => {
    expect(getMimeTypeFromUri('file:///photo.webp')).toBe('image/webp');
  });

  it('defaults to image/jpeg for unknown extension', () => {
    expect(getMimeTypeFromUri('file:///photo.bmp')).toBe('image/jpeg');
  });
});

describe('createImageValidationError', () => {
  it('creates an error with the correct message and code', () => {
    const err = createImageValidationError('test', 'INVALID_TYPE');
    expect(err.message).toBe('test');
    expect(err.code).toBe('INVALID_TYPE');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('constants', () => {
  it('ALLOWED_IMAGE_TYPES includes 4 types', () => {
    expect(ALLOWED_IMAGE_TYPES).toEqual([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ]);
  });

  it('MAX_IMAGE_SIZE is 5MB', () => {
    expect(MAX_IMAGE_SIZE).toBe(5 * 1024 * 1024);
  });

  it('MAX_PROFILE_SIZE is 2MB', () => {
    expect(MAX_PROFILE_SIZE).toBe(2 * 1024 * 1024);
  });
});
