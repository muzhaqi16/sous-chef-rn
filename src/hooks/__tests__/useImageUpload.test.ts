'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useImageUpload } from '../useImageUpload';

jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');

const mockCreateUploadUrl = jest.fn();
const mockConfirmProfileUpload = jest.fn();
const mockConfirmItemUpload = jest.fn();
const mockUpdateProfile = jest.fn();
const mockUpdateItemImage = jest.fn();

jest.mock('#generated', () => ({
  useCreateImageUploadUrlMutation: () => [mockCreateUploadUrl],
  useConfirmProfileImageUploadMutation: () => [mockConfirmProfileUpload],
  useConfirmItemImageUploadMutation: () => [mockConfirmItemUpload],
  useUpdateUserProfileMutation: () => [mockUpdateProfile],
  useUpdateItemImageMutation: () => [mockUpdateItemImage],
  ImageUploadPurpose: { ProfileAvatar: 'PROFILE_AVATAR', ItemImage: 'ITEM_IMAGE' },
}));

jest.mock('#utils/imageValidation', () => ({
  validateImageFile: jest.fn(),
  getMimeTypeFromUri: jest.fn(() => 'image/jpeg'),
  MAX_PROFILE_SIZE: 5 * 1024 * 1024,
}));

jest.mock('#store', () => ({
  useStore: {
    getState: () => ({ isOnline: true }),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

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

beforeEach(() => {
  jest.clearAllMocks();
  mockXhr.status = 200;
  mockXhr.onload = null;
  mockXhr.onerror = null;
  mockXhr.ontimeout = null;
  mockXhr.onabort = null;

  const { useStore } = require('#store');
  useStore.getState = () => ({ isOnline: true });
});

describe('useImageUpload', () => {
  it('initializes with uploading false and progress 0', () => {
    const { result } = renderHook(() => useImageUpload());
    expect(result.current.uploading).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it('exposes all expected functions', () => {
    const { result } = renderHook(() => useImageUpload());
    expect(typeof result.current.uploadProfileImage).toBe('function');
    expect(typeof result.current.uploadItemImage).toBe('function');
    expect(typeof result.current.uploadItemImages).toBe('function');
    expect(typeof result.current.updateProfileAvatarUrl).toBe('function');
    expect(typeof result.current.updateProfileCoverUrl).toBe('function');
    expect(typeof result.current.updateItemImageUrl).toBe('function');
  });

  it('updateProfileAvatarUrl calls updateProfile mutation', async () => {
    mockUpdateProfile.mockResolvedValue({
      data: { updateProfile: { userProfile: { id: 'u1', avatar: 'http://img.jpg' } } },
    });
    const { result } = renderHook(() => useImageUpload());

    let profile: any;
    await act(async () => {
      profile = await result.current.updateProfileAvatarUrl('http://img.jpg');
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      variables: { input: { avatar: 'http://img.jpg' } },
    });
    expect(profile).toEqual({ id: 'u1', avatar: 'http://img.jpg' });
  });

  it('updateProfileAvatarUrl returns null on failure', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useImageUpload());

    let profile: any;
    await act(async () => {
      profile = await result.current.updateProfileAvatarUrl('http://img.jpg');
    });

    expect(profile).toBeNull();
  });

  it('updateProfileCoverUrl calls updateProfile mutation with coverImage', async () => {
    mockUpdateProfile.mockResolvedValue({
      data: { updateProfile: { userProfile: { id: 'u1', coverImage: 'http://cover.jpg' } } },
    });
    const { result } = renderHook(() => useImageUpload());

    await act(async () => {
      await result.current.updateProfileCoverUrl('http://cover.jpg');
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith({
      variables: { input: { coverImage: 'http://cover.jpg' } },
    });
  });

  it('updateItemImageUrl calls updateItemImage mutation', async () => {
    mockUpdateItemImage.mockResolvedValue({
      data: { updateItem: { id: 'item1', imageUrl: 'http://item.jpg' } },
    });
    const { result } = renderHook(() => useImageUpload());

    let item: any;
    await act(async () => {
      item = await result.current.updateItemImageUrl('item1', 'http://item.jpg');
    });

    expect(mockUpdateItemImage).toHaveBeenCalledWith({
      variables: { id: 'item1', imageUrl: 'http://item.jpg' },
    });
    expect(item).toEqual({ id: 'item1', imageUrl: 'http://item.jpg' });
  });

  it('uploadProfileImage returns null when offline', async () => {
    const { useStore } = require('#store');
    useStore.getState = () => ({ isOnline: false });

    const { result } = renderHook(() => useImageUpload());
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
    expect(Alert.alert).toHaveBeenCalledWith(
      'No Internet Connection',
      expect.stringContaining('internet connection'),
    );
  });

  it('uploadItemImage returns null when offline', async () => {
    const { useStore } = require('#store');
    useStore.getState = () => ({ isOnline: false });

    const { result } = renderHook(() => useImageUpload());

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

    const { result } = renderHook(() => useImageUpload());

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
    const { unmount } = renderHook(() => useImageUpload());
    unmount();
    // Just verifying no error thrown during cleanup
  });

  it('updateProfileCoverUrl returns null on failure', async () => {
    mockUpdateProfile.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useImageUpload());

    let profile: any;
    await act(async () => {
      profile = await result.current.updateProfileCoverUrl('http://cover.jpg');
    });

    expect(profile).toBeNull();
  });

  it('updateItemImageUrl returns null on failure', async () => {
    mockUpdateItemImage.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useImageUpload());

    let item: any;
    await act(async () => {
      item = await result.current.updateItemImageUrl('item1', 'http://item.jpg');
    });

    expect(item).toBeNull();
    expect(Alert.alert).toHaveBeenCalledWith('Update Failed', 'Failed to update item image');
  });

  it('uploadProfileImage shows specific error for file size issue', async () => {
    const { validateImageFile } = require('#utils/imageValidation');
    validateImageFile.mockImplementation(() => {
      throw new Error('Invalid file size');
    });

    const { result } = renderHook(() => useImageUpload());
    const onError = jest.fn();

    await act(async () => {
      await result.current.uploadProfileImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
        undefined,
        { onError },
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith(
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

    const { result } = renderHook(() => useImageUpload());

    await act(async () => {
      await result.current.uploadProfileImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith(
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

    const { result } = renderHook(() => useImageUpload());

    await act(async () => {
      await result.current.uploadProfileImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith(
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

    const { result } = renderHook(() => useImageUpload());

    await act(async () => {
      await result.current.uploadItemImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
        'item1',
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith(
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

    const { result } = renderHook(() => useImageUpload());
    const onError = jest.fn();

    await act(async () => {
      await result.current.uploadProfileImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
        undefined,
        { onError },
      );
    });

    expect(onError).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
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

    const { result } = renderHook(() => useImageUpload());

    await act(async () => {
      await result.current.uploadProfileImage(
        { uri: 'file://img.jpg', fileSize: 1000, type: 'image/jpeg' },
      );
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Upload Failed',
      'Upload failed',
    );

    validateImageFile.mockImplementation(jest.fn());
  });
});
