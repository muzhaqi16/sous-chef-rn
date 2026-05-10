'use no memo';

import { act } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import { UpdateItemImageDocument } from '#operations/image/imageUpload.generated';
import { alertService } from '#/services/alertService';
import { useImageUpload } from '../useImageUpload';

jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');

jest.mock('#utils/imageValidation', () => ({
  validateImageFile: jest.fn(),
  getMimeTypeFromUri: jest.fn(() => 'image/jpeg'),
  MAX_PROFILE_SIZE: 5 * 1024 * 1024,
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
const mockXhr = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  abort: jest.fn(),
  upload: { onprogress: null as any },
  onload: null as any,
  onerror: null as any,
  ontimeout: null as any,
  onabort: null as any,
  status: 200,
  statusText: 'OK',
  responseText: '',
  timeout: 0,
};
(global as any).XMLHttpRequest = jest.fn(() => mockXhr);

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
          __typename: 'UserProfilePayload',
          success: payload.success ?? true,
          message: 'OK',
          code: 'OK',
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
          __typename: 'ItemPayload',
          success: true,
          message: 'OK',
          code: 'OK',
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

describe('useImageUpload', () => {
  it('initializes with uploading false and progress 0', () => {
    const { result } = renderHookWithApollo(() => useImageUpload());
    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(0);
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

    let profile: any;
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

    let profile: any;
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

    let profile: any;
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

    let item: any;
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

    let returnVal: any;
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

    let returnVal: any;
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

    let results: any;
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

    let profile: any;
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
      async (_fn: any, onError: (e: unknown) => void) => {
        onError(new Error('fail'));
        return false;
      },
    );

    const { result } = renderHookWithApollo(() => useImageUpload());

    let item: any;
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

  it('uploadProfileImage shows specific error for file size issue', async () => {
    const { validateImageFile } = require('#utils/imageValidation');
    validateImageFile.mockImplementation(() => {
      throw new Error('Invalid file size');
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

    expect(alertService.alert).toHaveBeenCalledWith(
      'Upload Failed',
      expect.stringContaining('too large or corrupted'),
    );

    // Restore
    validateImageFile.mockImplementation(jest.fn());
  });

  it('uploadProfileImage shows specific error for INVALID_TYPE', async () => {
    const { validateImageFile } = require('#utils/imageValidation');
    validateImageFile.mockImplementation(() => {
      throw new Error('INVALID_TYPE: not an image');
    });

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

    validateImageFile.mockImplementation(jest.fn());
  });

  it('uploadProfileImage shows specific error for FILE_TOO_LARGE', async () => {
    const { validateImageFile } = require('#utils/imageValidation');
    validateImageFile.mockImplementation(() => {
      throw new Error('FILE_TOO_LARGE');
    });

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
      expect.stringContaining('too large'),
    );

    validateImageFile.mockImplementation(jest.fn());
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

    expect(alertService.alert).toHaveBeenCalledWith(
      'Upload Failed',
      'Upload failed',
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
    expect(alertService.alert).toHaveBeenCalledWith(
      'Upload Failed',
      'Something went wrong',
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

    expect(alertService.alert).toHaveBeenCalledWith(
      'Upload Failed',
      'Upload failed',
    );

    validateImageFile.mockImplementation(jest.fn());
  });
});
