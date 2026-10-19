import { act, renderHook } from '@testing-library/react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { TextRecognition } from '#/native/TextRecognition';
import { useCapturePhotos, MAX_CAPTURE_PHOTOS } from '../useCapturePhotos';

jest.mock('#/native/TextRecognition', () => ({
  TextRecognition: {
    preparePhotos: jest.fn(),
    deletePhotos: jest.fn(() => Promise.resolve()),
  },
}));
const mockUploadUnconfirmed = jest.fn();
jest.mock('#hooks/useImageUpload', () => ({
  useImageUpload: () => ({ uploadUnconfirmed: mockUploadUnconfirmed }),
}));
const mockPickPhoto = jest.fn();
jest.mock('#hooks/usePhotoCapture', () => ({
  usePhotoCapture: () => ({ pickPhoto: mockPickPhoto }),
}));

const scanned = (...uris: string[]) =>
  jest.mocked(DocumentScanner.scanDocument).mockResolvedValueOnce({
    status: 'success',
    scannedImages: uris,
  } as Awaited<ReturnType<typeof DocumentScanner.scanDocument>>);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useCapturePhotos', () => {
  it('keeps at most three pages, deleting the rest', async () => {
    scanned('p1', 'p2');
    mockPickPhoto.mockResolvedValueOnce([{ uri: 'p3' }, { uri: 'p4' }]);
    const { result } = renderHook(() => useCapturePhotos());

    await act(async () => {
      await result.current.scan();
    });
    await act(async () => {
      await result.current.choose();
    });

    expect(result.current.pages).toEqual(['p1', 'p2', 'p3']);
    expect(result.current.canAddPage).toBe(false);
    expect(TextRecognition.deletePhotos).toHaveBeenCalledWith(['p4']);
    expect(MAX_CAPTURE_PHOTOS).toBe(3);
  });

  it('falls back to the library where no scanner exists', async () => {
    jest
      .mocked(DocumentScanner.scanDocument)
      .mockRejectedValueOnce(new Error('no scanner'));
    const { result } = renderHook(() => useCapturePhotos());

    await act(async () => {
      await result.current.scan();
    });

    expect(result.current.scannerUnavailable).toBe(true);
  });

  it('uploads each prepared page as a recipe photo, then deletes the prepared files', async () => {
    scanned('p1', 'p2');
    jest.mocked(TextRecognition.preparePhotos).mockResolvedValueOnce([
      { uri: 'prepared-1', fileSize: 100 },
      { uri: 'prepared-2', fileSize: 120 },
    ]);
    mockUploadUnconfirmed
      .mockResolvedValueOnce('key-1')
      .mockResolvedValueOnce('key-2');
    const { result } = renderHook(() => useCapturePhotos());
    await act(async () => {
      await result.current.scan();
    });

    let keys: string[] | null = null;
    await act(async () => {
      keys = await result.current.upload();
    });

    expect(keys).toEqual(['key-1', 'key-2']);
    expect(TextRecognition.preparePhotos).toHaveBeenCalledWith(['p1', 'p2'], {
      keepPages: true,
    });
    expect(mockUploadUnconfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'prepared-1' }),
      ImageUploadPurpose.RecipePhoto,
      expect.anything(),
    );
    expect(TextRecognition.deletePhotos).toHaveBeenCalledWith([
      'prepared-1',
      'prepared-2',
    ]);
  });

  it('keeps the pages for another try when one does not go up', async () => {
    scanned('p1');
    jest
      .mocked(TextRecognition.preparePhotos)
      .mockResolvedValueOnce([{ uri: 'prepared-1', fileSize: 100 }]);
    mockUploadUnconfirmed.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useCapturePhotos());
    await act(async () => {
      await result.current.scan();
    });

    let keys: string[] | null = [];
    await act(async () => {
      keys = await result.current.upload();
    });

    expect(keys).toBeNull();
    expect(result.current.pages).toEqual(['p1']);
  });

  it('deletes every page when discarded', async () => {
    scanned('p1', 'p2');
    const { result } = renderHook(() => useCapturePhotos());
    await act(async () => {
      await result.current.scan();
    });

    act(() => {
      result.current.discard();
    });

    expect(TextRecognition.deletePhotos).toHaveBeenLastCalledWith(['p1', 'p2']);
    expect(result.current.pages).toEqual([]);
  });
});
