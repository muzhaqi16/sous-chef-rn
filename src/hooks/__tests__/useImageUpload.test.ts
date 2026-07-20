'use no memo';

import { act } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import {
  ConfirmItemImageUploadDocument,
  CreateImageUploadUrlDocument,
  UpdateItemImageDocument,
} from '#operations/image/imageUpload.generated';
import { alertService } from '#/services/alertService';
import { useImageUpload } from '../useImageUpload';

type ImageUploadApi = ReturnType<typeof useImageUpload>;
type ProfileResult = Awaited<
  ReturnType<ImageUploadApi['updateProfileAvatarUrl']>
>;
type ProfileUploadResult = Awaited<
  ReturnType<ImageUploadApi['uploadProfileImage']>
>;
type ItemUploadResult = Awaited<ReturnType<ImageUploadApi['uploadItemImage']>>;
type ItemImagesResult = Awaited<ReturnType<ImageUploadApi['uploadItemImages']>>;
// `updateItemImageUrl` resolves to the `updateItem` result union; `item` exists
// only on the success member. Optional fields (plus `__typename`) let the
// success-path mock value be read for assertions.
type ItemImageData = {
  __typename?: string;
  item?: { id?: string; imageUrl?: string | null } | null;
} | null;

jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');

// Spread the real module and stub only the two functions under control. Listing
// exports by hand drifts: this factory predated MAX_IMAGE_SIZE and
// createImageValidationError, so both arrived as `undefined` in the hook, and
// its hand-written MAX_PROFILE_SIZE (5MB) disagreed with the real one (2MB).
jest.mock('#utils/imageValidation', () => ({
  ...jest.requireActual('#utils/imageValidation'),
  validateImageFile: jest.fn(),
  getMimeTypeFromUri: jest.fn(() => 'image/jpeg'),
}));

jest.mock('#store', () => ({
  useStore: {
    getState: () => ({ isOnline: true, updateUser: jest.fn() }),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

// Mock XMLHttpRequest
type XhrEventHandler = ((event: ProgressEvent) => void) | null;
const mockXhr = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  abort: jest.fn(),
  upload: { onprogress: null as XhrEventHandler },
  onload: null as XhrEventHandler,
  onerror: null as XhrEventHandler,
  ontimeout: null as XhrEventHandler,
  onabort: null as XhrEventHandler,
  status: 200,
  statusText: 'OK',
  responseText: '',
  timeout: 0,
};
(global as { XMLHttpRequest: unknown }).XMLHttpRequest = jest.fn(() => mockXhr);

// Helper builders for MockedResponse — these avoid spelling out the full
// generated payload shape inline at every test.
function buildUpdateProfileMock(
  input: { avatar?: string; coverImage?: string },
  payload: {
    success?: boolean;
    userProfile: {
      id: string;
      avatar?: string | null;
      coverImage?: string | null;
    };
  },
  error?: Error,
): MockedResponse {
  if (error) {
    return {
      request: { query: UpdateUserProfileDocument, variables: { input } },
      error,
    };
  }
  const { id, avatar, coverImage } = payload.userProfile;
  return {
    request: { query: UpdateUserProfileDocument, variables: { input } },
    result: {
      data: {
        updateProfile: {
          __typename: 'UpdateProfilePayload',
          userProfile: {
            __typename: 'UserProfile',
            id,
            userId: 'u1',
            firstName: null,
            lastName: null,
            displayName: null,
            bio: null,
            avatar: avatar ?? null,
            coverImage: coverImage ?? null,
            phone: null,
            website: null,
            dateOfBirth: null,
            gender: null,
            profileVisibility: 'PUBLIC',
            showEmail: true,
            showPhone: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        },
      },
    },
  };
}

function buildUpdateItemImageMock(
  variables: { id: string; imageUrl: string },
  itemImageUrl: string | null,
  error?: Error,
): MockedResponse {
  if (error) {
    return {
      request: { query: UpdateItemImageDocument, variables },
      error,
    };
  }
  return {
    request: { query: UpdateItemImageDocument, variables },
    result: {
      data: {
        updateItem: {
          __typename: 'UpdateItemPayload',
          item: {
            __typename: 'Item',
            id: variables.id,
            imageUrl: itemImageUrl,
          },
        },
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockXhr.status = 200;
  mockXhr.onload = null;
  mockXhr.onerror = null;
  mockXhr.ontimeout = null;
  mockXhr.onabort = null;

  const { useStore } = require('#store');
  useStore.getState = () => ({ isOnline: true, updateUser: jest.fn() });
});

// The presigned POST the server hands back. `fields` is the storage policy and
// is non-null on the payload — the upload is rejected without every entry.
const PRESIGN_FIELDS = [
  { __typename: 'UploadFormField' as const, name: 'key', value: 'items/i1/a' },
  { __typename: 'UploadFormField' as const, name: 'policy', value: 'eyJ0' },
  {
    __typename: 'UploadFormField' as const,
    name: 'x-amz-signature',
    value: 'sig',
  },
];

function buildPresignMock(): MockedResponse {
  return {
    request: { query: CreateImageUploadUrlDocument, variables: () => true },
    result: {
      data: {
        createImageUploadUrl: {
          __typename: 'CreateImageUploadUrlPayload',
          url: 'https://storage.test/bucket',
          key: 'items/i1/a',
          fields: PRESIGN_FIELDS,
        },
      },
    },
    maxUsageCount: 10,
  };
}

function buildConfirmItemMock(url: string): MockedResponse {
  return {
    request: { query: ConfirmItemImageUploadDocument, variables: () => true },
    result: {
      data: {
        confirmItemImageUpload: {
          __typename: 'ConfirmItemImageUploadPayload',
          url,
        },
      },
    },
    maxUsageCount: 10,
  };
}

describe('useImageUpload', () => {
  it('initializes with uploading false and progress 0', () => {
    const { result } = renderHookWithApollo(() => useImageUpload());
    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  // The server issues a presigned POST, not a PUT. Storage rejects the upload
  // unless every policy field precedes a file part named `file`, and the
  // Content-Type must be left to the runtime so the multipart boundary matches.
  describe('presigned POST upload', () => {
    const file = { uri: 'file://a.jpg', fileName: 'a.jpg', fileSize: 1024 };
    let appendSpy: jest.SpyInstance;

    beforeEach(() => {
      // Storage answers asynchronously. Driving onload from send() rather than
      // from the test body means the reply can't land before the hook is
      // listening for it.
      mockXhr.send.mockImplementation(() => {
        setImmediate(() => mockXhr.onload?.({} as ProgressEvent));
      });
      appendSpy = jest.spyOn(FormData.prototype, 'append');
    });

    afterEach(() => {
      appendSpy.mockRestore();
      mockXhr.send.mockReset();
    });

    async function runUpload(): Promise<ItemUploadResult> {
      const { result } = renderHookWithApollo(() => useImageUpload(), {
        operationMocks: [
          buildPresignMock(),
          buildConfirmItemMock('https://cdn.test/a.jpg'),
        ],
      });

      let uploaded: ItemUploadResult = null;
      await act(async () => {
        uploaded = await result.current.uploadItemImage(file, 'item-1');
      });
      return uploaded;
    }

    it('POSTs to the presigned url rather than PUTting', async () => {
      await runUpload();

      expect(mockXhr.open).toHaveBeenCalledWith(
        'POST',
        'https://storage.test/bucket',
      );
    });

    it('never sets Content-Type — the runtime owns the multipart boundary', async () => {
      await runUpload();

      expect(mockXhr.setRequestHeader).not.toHaveBeenCalledWith(
        'Content-Type',
        expect.anything(),
      );
    });

    it('sends every policy field, with the file part last', async () => {
      await runUpload();

      const names = appendSpy.mock.calls.map(([name]) => name);

      expect(names).toEqual(['key', 'policy', 'x-amz-signature', 'file']);
    });

    it('returns the confirmed url', async () => {
      const uploaded = await runUpload();

      expect(uploaded).toBe('https://cdn.test/a.jpg');
    });

    it("normalizes a picker-reported 'image/jpg' to 'image/jpeg' in the presign mime", async () => {
      // Some Android providers report the non-standard 'image/jpg'; the API
      // accepts only image/jpeg | image/png | image/webp and rejects the raw
      // value with a ValidationError.
      const { mock, fired } = recordMock(CreateImageUploadUrlDocument, {
        data: {
          createImageUploadUrl: {
            __typename: 'CreateImageUploadUrlPayload',
            url: 'https://storage.test/bucket',
            key: 'items/i1/a',
            fields: PRESIGN_FIELDS,
          },
        },
      });

      const { result } = renderHookWithApollo(() => useImageUpload(), {
        operationMocks: [mock, buildConfirmItemMock('https://cdn.test/a.jpg')],
      });

      await act(async () => {
        await result.current.uploadItemImage(
          { ...file, type: 'image/jpg' },
          'item-1',
        );
      });

      expect(fired).toContainEqual({
        input: expect.objectContaining({ mime: 'image/jpeg' }),
      });
    });
  });

  it('exposes all expected functions', () => {
    const { result } = renderHookWithApollo(() => useImageUpload());
    expect(typeof result.current.uploadProfileImage).toBe('function');
    expect(typeof result.current.uploadItemImage).toBe('function');
    expect(typeof result.current.uploadItemImages).toBe('function');
    expect(typeof result.current.updateProfileAvatarUrl).toBe('function');
    expect(typeof result.current.updateProfileCoverUrl).toBe('function');
    expect(typeof result.current.updateItemImageUrl).toBe('function');
  });

  it('updateProfileAvatarUrl calls updateProfile mutation', async () => {
    const { result } = renderHookWithApollo(() => useImageUpload(), {
      operationMocks: [
        buildUpdateProfileMock(
          { avatar: 'http://img.jpg' },
          { userProfile: { id: 'u1', avatar: 'http://img.jpg' } },
        ),
      ],
    });

    let profile: ProfileResult | undefined;
    await act(async () => {
      profile = await result.current.updateProfileAvatarUrl('http://img.jpg');
    });

    expect(profile?.id).toBe('u1');
    expect(profile?.avatar).toBe('http://img.jpg');
  });

  it('updateProfileAvatarUrl returns null on failure', async () => {
    // executeMutation returns false on error → updateProfileAvatarUrl returns null.
    const { executeMutation } = require('#/utils/compilerSafeWrappers');
    executeMutation.mockResolvedValueOnce(false);

    const { result } = renderHookWithApollo(() => useImageUpload());

    let profile: ProfileResult | undefined;
    await act(async () => {
      profile = await result.current.updateProfileAvatarUrl('http://img.jpg');
    });

    expect(profile).toBeNull();
  });

  it('updateProfileCoverUrl calls updateProfile mutation with coverImage', async () => {
    const { result } = renderHookWithApollo(() => useImageUpload(), {
      operationMocks: [
        buildUpdateProfileMock(
          { coverImage: 'http://cover.jpg' },
          { userProfile: { id: 'u1', coverImage: 'http://cover.jpg' } },
        ),
      ],
    });

    let profile: ProfileResult | undefined;
    await act(async () => {
      profile = await result.current.updateProfileCoverUrl('http://cover.jpg');
    });

    expect(profile?.coverImage).toBe('http://cover.jpg');
  });

  it('updateItemImageUrl calls updateItemImage mutation', async () => {
    const { result } = renderHookWithApollo(() => useImageUpload(), {
      operationMocks: [
        buildUpdateItemImageMock(
          { id: 'item1', imageUrl: 'http://item.jpg' },
          'http://item.jpg',
        ),
      ],
    });

    let item: ItemImageData | undefined;
    await act(async () => {
      item = await result.current.updateItemImageUrl(
        'item1',
        'http://item.jpg',
      );
    });

    expect(item?.item?.id).toBe('item1');
    expect(item?.item?.imageUrl).toBe('http://item.jpg');
  });

  it('uploadProfileImage returns null when offline', async () => {
    const { useStore } = require('#store');
    useStore.getState = () => ({ isOnline: false });

    const { result } = renderHookWithApollo(() => useImageUpload());
    const onError = jest.fn();

    let returnVal: ProfileUploadResult | undefined;
    await act(async () => {
      returnVal = await result.current.uploadProfileImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
        undefined,
        { onError },
      );
    });

    expect(returnVal).toBeNull();
    expect(alertService.alert).toHaveBeenCalledWith(
      'No Internet Connection',
      expect.stringContaining('internet connection'),
    );
  });

  it('uploadItemImage returns null when offline', async () => {
    const { useStore } = require('#store');
    useStore.getState = () => ({ isOnline: false });

    const { result } = renderHookWithApollo(() => useImageUpload());

    let returnVal: ItemUploadResult | undefined;
    await act(async () => {
      returnVal = await result.current.uploadItemImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
        'item1',
      );
    });

    expect(returnVal).toBeNull();
  });

  it('uploadItemImages returns empty array when all uploads fail', async () => {
    const { useStore } = require('#store');
    useStore.getState = () => ({ isOnline: false });

    const { result } = renderHookWithApollo(() => useImageUpload());

    let results: ItemImagesResult | undefined;
    await act(async () => {
      results = await result.current.uploadItemImages(
        [{ uri: 'file://a.jpg', perspective: 'front' }],
        'item1',
      );
    });

    expect(results).toEqual([]);
  });

  it('cleanup aborts active XHR on unmount', () => {
    const { unmount } = renderHookWithApollo(() => useImageUpload());
    unmount();
    // Just verifying no error thrown during cleanup
  });

  it('updateProfileCoverUrl returns null on failure', async () => {
    const { executeMutation } = require('#/utils/compilerSafeWrappers');
    executeMutation.mockResolvedValueOnce(false);

    const { result } = renderHookWithApollo(() => useImageUpload());

    let profile: ProfileResult | undefined;
    await act(async () => {
      profile = await result.current.updateProfileCoverUrl('http://cover.jpg');
    });

    expect(profile).toBeNull();
  });

  it('updateItemImageUrl returns null on failure', async () => {
    // The hook uses executeMutation(...) — mock it once to simulate the
    // error path without trying to coerce Apollo's mock link to throw under
    // our test wrapper's errorPolicy: 'all' default.
    const { executeMutation } = require('#/utils/compilerSafeWrappers');
    executeMutation.mockImplementationOnce(
      async (_fn: () => Promise<unknown>, onError: (e: unknown) => void) => {
        onError(new Error('fail'));
        return false;
      },
    );

    const { result } = renderHookWithApollo(() => useImageUpload());

    let item: ItemImageData | undefined;
    await act(async () => {
      item = await result.current.updateItemImageUrl(
        'item1',
        'http://item.jpg',
      );
    });

    expect(item).toBeNull();
    expect(alertService.alert).toHaveBeenCalledWith(
      'Update Failed',
      'Failed to update item image',
    );
  });

  // These throw what the real `validateImageFile` throws — the code on
  // `error.code`, the human message on `error.message`. Fabricating an error
  // whose *message* carries the code (`new Error('INVALID_TYPE: ...')`) is what
  // let a dead branch look covered: production never produced that shape, so
  // the classifier fell through and alerted the raw English message instead.
  const throwValidationError = (
    message: string,
    code: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'UNKNOWN_ERROR',
  ) => {
    // createImageValidationError comes through requireActual in the module
    // factory above, so the thrown shape matches production exactly.
    const {
      validateImageFile,
      createImageValidationError,
    } = require('#utils/imageValidation');
    validateImageFile.mockImplementation(() => {
      throw createImageValidationError(message, code);
    });
  };

  const restoreValidation = () => {
    const { validateImageFile } = require('#utils/imageValidation');
    validateImageFile.mockImplementation(jest.fn());
  };

  it('reports an unreadable file when the size cannot be determined', async () => {
    throwValidationError('Unable to determine file size', 'UNKNOWN_ERROR');

    const { result } = renderHookWithApollo(() => useImageUpload());
    const onError = jest.fn();

    await act(async () => {
      await result.current.uploadProfileImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
        undefined,
        { onError },
      );
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Upload Failed',
      expect.stringContaining("couldn't read that image"),
    );

    restoreValidation();
  });

  it('classifies INVALID_TYPE by code, not by message text', async () => {
    // The real message says nothing about 'INVALID_TYPE' — only `code` does.
    throwValidationError(
      'Only JPEG, PNG, and WebP images are allowed',
      'INVALID_TYPE',
    );

    const { result } = renderHookWithApollo(() => useImageUpload());

    await act(async () => {
      await result.current.uploadProfileImage({
        uri: 'file://img.jpg',
        fileSize: 1000,
        type: 'image/jpeg',
      });
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Upload Failed',
      expect.stringContaining('JPEG, PNG, or WebP'),
    );

    restoreValidation();
  });

  it('quotes the profile size limit on FILE_TOO_LARGE', async () => {
    throwValidationError('File too large. Maximum size: 2MB', 'FILE_TOO_LARGE');

    const { result } = renderHookWithApollo(() => useImageUpload());

    await act(async () => {
      await result.current.uploadProfileImage({
        uri: 'file://img.jpg',
        fileSize: 1000,
        type: 'image/jpeg',
      });
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Upload Failed',
      expect.stringContaining('Profile images must be under 2MB'),
    );

    restoreValidation();
  });

  // The transport errors carry no code, and their messages are internal
  // control-flow signals ('Upload request timed out') that must never surface.
  it('falls back to translated copy for an uncoded failure', async () => {
    const { validateImageFile } = require('#utils/imageValidation');
    validateImageFile.mockImplementation(() => {
      throw new Error('Network request failed during upload');
    });

    const { result } = renderHookWithApollo(() => useImageUpload());

    await act(async () => {
      await result.current.uploadItemImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
        'item-1',
      );
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Upload Failed',
      'Something went wrong uploading your image. Please try again.',
    );

    restoreValidation();
  });

  it('uploadItemImage shows error alert on failure', async () => {
    const { validateImageFile } = require('#utils/imageValidation');
    validateImageFile.mockImplementation(() => {
      throw new Error('Upload failed');
    });

    const { result } = renderHookWithApollo(() => useImageUpload());

    await act(async () => {
      await result.current.uploadItemImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
        'item1',
      );
    });

    // 'Upload failed' is an internal signal, not copy. It used to be alerted
    // verbatim; an uncoded failure now gets translated text.
    expect(alertService.alert).toHaveBeenCalledWith(
      'Upload Failed',
      'Something went wrong uploading your image. Please try again.',
    );

    validateImageFile.mockImplementation(jest.fn());
  });

  it('uploadProfileImage generic error message for unknown errors', async () => {
    const { validateImageFile } = require('#utils/imageValidation');
    validateImageFile.mockImplementation(() => {
      throw new Error('Something went wrong');
    });

    const { result } = renderHookWithApollo(() => useImageUpload());
    const onError = jest.fn();

    await act(async () => {
      await result.current.uploadProfileImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
        undefined,
        { onError },
      );
    });

    expect(onError).toHaveBeenCalled();
    // An error with no `code` can't be classified, so it must not leak its
    // message ('Something went wrong') into the alert.
    expect(alertService.alert).toHaveBeenCalledWith(
      'Upload Failed',
      'Something went wrong uploading your image. Please try again.',
    );

    validateImageFile.mockImplementation(jest.fn());
  });

  it('uploadProfileImage calls onError with non-Error value', async () => {
    const { validateImageFile } = require('#utils/imageValidation');
    validateImageFile.mockImplementation(() => {
      throw 'string error';
    });

    const { result } = renderHookWithApollo(() => useImageUpload());

    await act(async () => {
      await result.current.uploadProfileImage({
        uri: 'file://img.jpg',
        fileSize: 1000,
        type: 'image/jpeg',
      });
    });

    // A thrown string has no `code` either — same translated fallback.
    expect(alertService.alert).toHaveBeenCalledWith(
      'Upload Failed',
      'Something went wrong uploading your image. Please try again.',
    );

    validateImageFile.mockImplementation(jest.fn());
  });
});
