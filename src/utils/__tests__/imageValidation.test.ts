import {
  sniffImageMimeType,
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

describe('sniffImageMimeType', () => {
  const originalFetch = global.fetch;
  const originalAtob = globalThis.atob;
  const originalFileReader = global.FileReader;

  /** Stands in for the RN blob pipeline: fetch → blob → slice → readAsDataURL. */
  function mockFileBytes(bytes: number[] | null) {
    const base64 =
      bytes === null ? null : Buffer.from(bytes).toString('base64');
    global.fetch = jest.fn().mockResolvedValue({
      blob: async () => ({
        slice: () => ({ __base64: base64 }),
      }),
    }) as unknown as typeof fetch;
    globalThis.atob = ((input: string) =>
      Buffer.from(input, 'base64').toString('binary')) as typeof atob;
    global.FileReader = class {
      result: string | null = null;
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      error: unknown = null;
      readAsDataURL(blob: { __base64: string | null }) {
        if (blob.__base64 === null) {
          this.error = new Error('unreadable');
          this.onerror?.();
          return;
        }
        this.result = `data:application/octet-stream;base64,${blob.__base64}`;
        this.onloadend?.();
      }
    } as unknown as typeof FileReader;
  }

  afterEach(() => {
    global.fetch = originalFetch;
    globalThis.atob = originalAtob;
    global.FileReader = originalFileReader;
  });

  it('reads JPEG, PNG and WebP from their leading bytes', async () => {
    mockFileBytes([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    await expect(sniffImageMimeType('file:///a.png')).resolves.toBe(
      'image/jpeg',
    );

    mockFileBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    await expect(sniffImageMimeType('file:///a.jpg')).resolves.toBe(
      'image/png',
    );

    // "RIFF" + 4 length bytes + "WEBP" — the length is whatever the file says.
    mockFileBytes([
      0x52, 0x49, 0x46, 0x46, 0x2a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    await expect(sniffImageMimeType('file:///a.jpg')).resolves.toBe(
      'image/webp',
    );
  });

  it('believes the bytes, not the extension', async () => {
    // The whole point: a `.png` carrying JPEG bytes is a JPEG, and presigning
    // for `.png` would be refused at confirm after the file had uploaded.
    mockFileBytes([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    await expect(sniffImageMimeType('file:///photo.png')).resolves.toBe(
      'image/jpeg',
    );
  });

  it('is null for bytes that are not a supported image', async () => {
    mockFileBytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0, 0, 0, 0, 0]); // %PDF-
    await expect(sniffImageMimeType('file:///a.pdf')).resolves.toBeNull();
  });

  it('is null rather than throwing when the head cannot be read', async () => {
    // A platform that cannot slice a blob must degrade to the reported type,
    // not lose the ability to upload at all.
    mockFileBytes(null);
    await expect(sniffImageMimeType('file:///a.jpg')).resolves.toBeNull();

    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('no such file')) as unknown as typeof fetch;
    await expect(sniffImageMimeType('file:///gone.jpg')).resolves.toBeNull();
  });
});
