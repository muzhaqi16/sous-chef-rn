import { act, renderHook } from '@testing-library/react-native';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import { TextRecognition, type RecognizedPage } from '#/native/TextRecognition';
import { ReceiptStructuring } from '#/native/ReceiptStructuring';
import { onDeviceStructuring } from '../../utils/onDeviceStructuring';
import { errorService } from '#/services/errorService';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { toDateKey } from '#/utils/dateUtils';
import * as deviceLocale from '#/utils/deviceLocale';
import { useStore } from '#store';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import { useReceiptScan } from '../useReceiptScan';

jest.mock('#/storage/mmkv');
jest.mock('#/native/TextRecognition', () => ({
  TextRecognition: {
    recognizeAndDelete: jest.fn(),
    preparePhotos: jest.fn(),
    deletePhotos: jest.fn(),
  },
}));
const mockUploadReceiptPhoto = jest.fn();
jest.mock('#hooks/useImageUpload', () => ({
  useImageUpload: () => ({ uploadReceiptPhoto: mockUploadReceiptPhoto }),
}));
const mockTakePhoto = jest.fn();
const mockPickPhoto = jest.fn();
jest.mock('#hooks/usePhotoCapture', () => ({
  usePhotoCapture: () => ({
    takePhoto: mockTakePhoto,
    pickPhoto: mockPickPhoto,
  }),
}));
jest.mock('#/native/ReceiptStructuring', () => ({
  ReceiptStructuring: { availability: jest.fn(), labelLines: jest.fn() },
}));

const scanDocument = jest.mocked(DocumentScanner.scanDocument);
const recognizeAndDelete = jest.mocked(TextRecognition.recognizeAndDelete);
const preparePhotos = jest.mocked(TextRecognition.preparePhotos);
const deletePhotos = jest.mocked(TextRecognition.deletePhotos);
const availability = jest.mocked(ReceiptStructuring.availability);
const labelLines = jest.mocked(ReceiptStructuring.labelLines);

const line = (text: string, y: number) => ({
  text,
  x: 0.05,
  y,
  width: 0.5,
  height: 0.03,
});

const RECEIPT: RecognizedPage[] = [
  {
    lines: [
      line('WALMART', 0.05),
      line('GV WHOLE MILK  3.48 N', 0.1),
      line('VISA ************4242', 0.15),
      line('AUTH CODE 123456', 0.2),
    ],
  },
];

const renderScan = () => {
  const onCancel = jest.fn();
  const view = renderHook(() => useReceiptScan({ onCancel }));
  return { ...view, onCancel };
};

const dateOrder = jest.spyOn(deviceLocale, 'getDeviceDateOrder');

beforeEach(() => {
  jest.clearAllMocks();
  useReceiptDraftStore.getState().clearDraft();
  availability.mockResolvedValue('unavailable');
  dateOrder.mockReturnValue('monthFirst');
  deletePhotos.mockResolvedValue(undefined);
  useStore.setState({ isOnline: true });
});

const scannedOnePage = () => {
  scanDocument.mockResolvedValue({
    status: ScanDocumentResponseStatus.Success,
    scannedImages: ['file:///page.jpg'],
  });
  recognizeAndDelete.mockResolvedValue(RECEIPT);
};

describe('useReceiptScan', () => {
  it('keeps only the redacted text of every page as the draft', async () => {
    scanDocument.mockResolvedValue({
      status: ScanDocumentResponseStatus.Success,
      scannedImages: ['file:///page-1.jpg', 'file:///page-2.jpg'],
    });
    recognizeAndDelete.mockResolvedValue(RECEIPT);
    const { result } = renderScan();

    await act(() => result.current.scan());

    expect(recognizeAndDelete).toHaveBeenCalledWith([
      'file:///page-1.jpg',
      'file:///page-2.jpg',
    ]);
    expect(result.current.status).toBe('saved');
    const draft = useReceiptDraftStore.getState().draft;
    expect(draft?.pages).toEqual(['WALMART\nGV WHOLE MILK  3.48 N']);
    expect(JSON.stringify(draft)).not.toMatch(/4242|123456|file:/);
  });

  // Receipts print the day under the payment block, which redaction cuts, so it
  // is read first; the cut lines still never reach the draft.
  it('keeps the day the receipt printed below its payment block', async () => {
    const today = new Date();
    const printed = [
      today.getMonth() + 1,
      today.getDate(),
      today.getFullYear() % 100,
    ]
      .map(part => String(part).padStart(2, '0'))
      .join('/');
    scannedOnePage();
    recognizeAndDelete.mockResolvedValue([
      {
        lines: [
          line('WALMART', 0.05),
          line('GV WHOLE MILK  3.48 N', 0.1),
          line('CHANGE DUE  0.00', 0.15),
          line(`${printed} 14:22:31  TC# 4412 0021`, 0.2),
        ],
      },
    ]);
    const { result } = renderScan();

    await act(() => result.current.scan());

    const draft = useReceiptDraftStore.getState().draft;
    expect(draft?.purchasedOn).toBe(toDateKey(today));
    expect(draft?.pages).toEqual([
      'WALMART\nGV WHOLE MILK  3.48 N\nCHANGE DUE  0.00',
    ]);
    expect(JSON.stringify(draft)).not.toMatch(/TC#|14:22/);
  });

  it("reads the printed day in the device region's order", async () => {
    dateOrder.mockReturnValue('dayFirst');
    const today = new Date();
    const printed = [today.getDate(), today.getMonth() + 1, today.getFullYear()]
      .map(part => String(part).padStart(2, '0'))
      .join('/');
    scannedOnePage();
    recognizeAndDelete.mockResolvedValue([
      {
        lines: [
          line('CONAD', 0.05),
          line('LATTE INTERO  1.29', 0.1),
          line(`${printed} 10:12`, 0.15),
        ],
      },
    ]);
    const { result } = renderScan();

    await act(() => result.current.scan());

    expect(useReceiptDraftStore.getState().draft?.purchasedOn).toBe(
      toDateKey(today),
    );
  });

  it('returns to the add sheet with nothing kept when the scanner is cancelled', async () => {
    scanDocument.mockResolvedValue({
      status: ScanDocumentResponseStatus.Cancel,
    });
    const { result, onCancel } = renderScan();

    await act(() => result.current.scan());

    expect(onCancel).toHaveBeenCalled();
    expect(recognizeAndDelete).not.toHaveBeenCalled();
    expect(useReceiptDraftStore.getState().draft).toBeNull();
  });

  it('keeps the saved receipt when a replacement scan is cancelled', async () => {
    useReceiptDraftStore
      .getState()
      .saveDraft({ pages: ['MILK  3.48'], scannedAt: '2026-09-30T12:00:00Z' });
    scanDocument.mockResolvedValue({
      status: ScanDocumentResponseStatus.Cancel,
    });
    const { result, onCancel } = renderScan();

    await act(() => result.current.scan());

    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.status).toBe('saved');
    expect(useReceiptDraftStore.getState().draft?.pages).toEqual([
      'MILK  3.48',
    ]);
  });

  it('asks the scanner for at most ten pages, and keeps a longer scan as ten', async () => {
    const shots = Array.from({ length: 12 }, (_, at) => at + 1);
    scanDocument.mockResolvedValue({
      status: ScanDocumentResponseStatus.Success,
      scannedImages: shots.map(shot => `file:///page-${shot}.jpg`),
    });
    recognizeAndDelete.mockResolvedValue(
      shots.map(shot => ({ lines: [line(`ITEM ${shot}  1.00`, 0.1)] })),
    );
    const { result } = renderScan();

    await act(() => result.current.scan());

    expect(scanDocument).toHaveBeenCalledWith(
      expect.objectContaining({ maxNumDocuments: 10 }),
    );
    const pages = useReceiptDraftStore.getState().draft?.pages;
    expect(pages).toHaveLength(10);
    expect(pages?.[8]).toBe('ITEM 9  1.00');
    expect(pages?.[9]).toBe('ITEM 10  1.00\nITEM 11  1.00\nITEM 12  1.00');
  });

  it('asks for a retake, not an empty review, when no item line was read', async () => {
    scanDocument.mockResolvedValue({
      status: ScanDocumentResponseStatus.Success,
      scannedImages: ['file:///blurry.jpg'],
    });
    recognizeAndDelete.mockResolvedValue([{ lines: [line('WALMART', 0.05)] }]);
    const { result } = renderScan();

    await act(() => result.current.scan());

    expect(result.current.status).toBe('unreadable');
    expect(useReceiptDraftStore.getState().draft).toBeNull();
  });

  describe('when the phone cannot read the pages', () => {
    const PAGES = Array.from(
      { length: 5 },
      (_, at) => `file:///page-${at}.jpg`,
    );

    const failedRead = async () => {
      const view = renderScan();
      scanDocument.mockResolvedValue({
        status: ScanDocumentResponseStatus.Success,
        scannedImages: PAGES,
      });
      recognizeAndDelete.mockRejectedValueOnce(new Error('vision failed'));
      await act(() => view.result.current.scan());
      return view;
    };

    it('asks before sending anything, and keeps the pages until it is told', async () => {
      const { result } = await failedRead();

      expect(result.current.status).toBe('readFailed');
      expect(deletePhotos).not.toHaveBeenCalled();
      expect(preparePhotos).not.toHaveBeenCalled();
      expect(mockUploadReceiptPhoto).not.toHaveBeenCalled();
      expect(useReceiptDraftStore.getState().draft).toBeNull();
    });

    it('sends up to four photos on consent, keeps only their keys, and deletes every copy', async () => {
      const { result } = await failedRead();
      preparePhotos.mockImplementation(async uris =>
        uris.map((_, at) => ({
          uri: `file:///prepared-${at}.jpg`,
          fileSize: 900,
        })),
      );
      mockUploadReceiptPhoto.mockImplementation(async (file: { uri: string }) =>
        file.uri.replace('file:///prepared', 'receipt-photos/u1/p'),
      );

      await act(() => result.current.sendPhotos());

      expect(preparePhotos).toHaveBeenCalledWith(PAGES.slice(0, 4));
      // The fifth page is not sent and goes at once.
      expect(deletePhotos).toHaveBeenCalledWith(PAGES.slice(4));
      expect(mockUploadReceiptPhoto).toHaveBeenCalledTimes(4);
      expect(deletePhotos).toHaveBeenCalledWith([
        'file:///prepared-0.jpg',
        'file:///prepared-1.jpg',
        'file:///prepared-2.jpg',
        'file:///prepared-3.jpg',
      ]);
      expect(useReceiptDraftStore.getState().draft).toEqual(
        expect.objectContaining({
          pages: [],
          photoKeys: [
            'receipt-photos/u1/p-0.jpg',
            'receipt-photos/u1/p-1.jpg',
            'receipt-photos/u1/p-2.jpg',
            'receipt-photos/u1/p-3.jpg',
          ],
        }),
      );
      expect(result.current.status).toBe('saved');
    });

    it('keeps nothing when a photo does not go up', async () => {
      const { result } = await failedRead();
      preparePhotos.mockResolvedValue([
        { uri: 'file:///prepared-0.jpg', fileSize: 900 },
      ]);
      mockUploadReceiptPhoto.mockRejectedValueOnce(
        new Error('Upload failed: 400'),
      );

      await act(() => result.current.sendPhotos());

      expect(deletePhotos).toHaveBeenCalledWith(['file:///prepared-0.jpg']);
      expect(useReceiptDraftStore.getState().draft).toBeNull();
      expect(result.current.status).toBe('failed');
    });

    it('sends nothing and deletes the pages when the user declines', async () => {
      const { result } = await failedRead();

      act(() => result.current.declinePhotos());

      expect(deletePhotos).toHaveBeenCalledWith(PAGES);
      expect(preparePhotos).not.toHaveBeenCalled();
      expect(mockUploadReceiptPhoto).not.toHaveBeenCalled();
      expect(result.current.status).toBe('idle');
    });

    it('waits for a connection to send', async () => {
      useStore.setState({ isOnline: false });
      const { result } = await failedRead();

      expect(result.current.canSendPhotos).toBe(false);
      await act(() => result.current.sendPhotos());

      expect(preparePhotos).not.toHaveBeenCalled();
      expect(result.current.status).toBe('readFailed');
    });

    it('deletes the pages when the screen goes before the user decides', async () => {
      const { unmount } = await failedRead();

      unmount();

      expect(deletePhotos).toHaveBeenCalledWith(PAGES);
    });
  });

  it('shows a draft that the store restores after the screen opened', async () => {
    const { result } = renderScan();
    expect(result.current.status).toBe('idle');

    await act(async () => {
      useReceiptDraftStore.getState().saveDraft({
        pages: ['MILK  3.48'],
        scannedAt: '2026-09-30T12:00:00Z',
      });
    });
    expect(result.current.status).toBe('saved');
  });

  it('reopens on a saved draft, discards it, and loses it at sign-out', async () => {
    useReceiptDraftStore
      .getState()
      .saveDraft({ pages: ['MILK  3.48'], scannedAt: '2026-09-30T12:00:00Z' });
    const { result } = renderScan();
    expect(result.current.status).toBe('saved');

    act(() => result.current.discard());
    expect(result.current.status).toBe('idle');
    expect(useReceiptDraftStore.getState().draft).toBeNull();

    useReceiptDraftStore
      .getState()
      .saveDraft({ pages: ['MILK  3.48'], scannedAt: '2026-09-30T12:00:00Z' });
    resetSessionScopedStores();
    expect(useReceiptDraftStore.getState().draft).toBeNull();
  });

  describe('on-device structuring', () => {
    let turnedOn: jest.ReplaceProperty<boolean | undefined>;
    beforeEach(() => {
      turnedOn = jest.replaceProperty(onDeviceStructuring, 'ios', true);
    });
    afterEach(() => {
      turnedOn.restore();
    });

    it('adds what the phone’s model read to the draft', async () => {
      scannedOnePage();
      availability.mockResolvedValue('available');
      labelLines.mockResolvedValue({
        storeName: 'WALMART',
        lines: [
          { line: 0, label: 'header' },
          { line: 1, label: 'item', product: 'GV WHOLE MILK' },
        ],
      });
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(labelLines).toHaveBeenCalledWith([
        'WALMART',
        'GV WHOLE MILK  3.48 N',
      ]);
      expect(result.current.status).toBe('saved');
      const draft = useReceiptDraftStore.getState().draft;
      expect(draft?.pages).toEqual(['WALMART\nGV WHOLE MILK  3.48 N']);
      expect(draft?.parsed?.merchant).toBe('WALMART');
      expect(
        draft?.parsed?.lines.filter(parsed => parsed.kind === 'item'),
      ).toEqual([
        expect.objectContaining({
          product: 'GV WHOLE MILK',
          lineTotal: 3.48,
        }),
      ]);
    });

    it('keeps the plain text when the model fails', async () => {
      scannedOnePage();
      availability.mockResolvedValue('available');
      labelLines.mockRejectedValue(new Error('model busy'));
      const reportError = jest.spyOn(errorService, 'reportError');
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(result.current.status).toBe('saved');
      expect(useReceiptDraftStore.getState().draft?.pages).toHaveLength(1);
      expect(useReceiptDraftStore.getState().draft?.parsed).toBeUndefined();
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        operation: 'Label receipt lines on device',
      });
      reportError.mockRestore();
    });

    it('stops waiting for a model that does not answer', async () => {
      jest.useFakeTimers();
      scannedOnePage();
      availability.mockResolvedValue('available');
      labelLines.mockReturnValue(new Promise(() => {}));
      const { result } = renderScan();

      const scanning = result.current.scan();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(20_000);
        await scanning;
      });

      expect(result.current.status).toBe('saved');
      expect(useReceiptDraftStore.getState().draft?.parsed).toBeUndefined();
      jest.useRealTimers();
    });

    it('never asks the model on a platform where it is turned off', async () => {
      turnedOn.replaceValue(false);
      scannedOnePage();
      availability.mockResolvedValue('available');
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(availability).not.toHaveBeenCalled();
      expect(labelLines).not.toHaveBeenCalled();
      expect(result.current.status).toBe('saved');
      expect(useReceiptDraftStore.getState().draft?.parsed).toBeUndefined();
    });

    it('never asks a phone without a model', async () => {
      scannedOnePage();
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(labelLines).not.toHaveBeenCalled();
      expect(useReceiptDraftStore.getState().draft?.parsed).toBeUndefined();
    });
  });

  describe('without a document scanner', () => {
    beforeEach(() => {
      scanDocument.mockRejectedValue(
        new Error('Document scanning is not supported on this device'),
      );
    });

    it('offers a photo instead of failing', async () => {
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(result.current.status).toBe('scannerUnavailable');
      expect(recognizeAndDelete).not.toHaveBeenCalled();
    });

    it('reads a photo taken with the camera like a scanned page', async () => {
      mockTakePhoto.mockResolvedValue([{ uri: 'file:///cache/photo.jpg' }]);
      recognizeAndDelete.mockResolvedValue(RECEIPT);
      const { result } = renderScan();
      await act(() => result.current.scan());

      await act(() => result.current.takePhoto());

      expect(recognizeAndDelete).toHaveBeenCalledWith([
        'file:///cache/photo.jpg',
      ]);
      expect(result.current.status).toBe('saved');
      expect(useReceiptDraftStore.getState().draft?.pages).toEqual([
        'WALMART\nGV WHOLE MILK  3.48 N',
      ]);
    });

    it('reads a chosen photo too, and stays put when none is chosen', async () => {
      mockPickPhoto.mockResolvedValueOnce([]);
      const { result } = renderScan();
      await act(() => result.current.scan());

      await act(() => result.current.pickPhoto());
      expect(result.current.status).toBe('scannerUnavailable');
      expect(recognizeAndDelete).not.toHaveBeenCalled();

      mockPickPhoto.mockResolvedValueOnce([
        { uri: 'file:///cache/chosen.jpg' },
      ]);
      recognizeAndDelete.mockResolvedValue(RECEIPT);
      await act(() => result.current.pickPhoto());

      expect(recognizeAndDelete).toHaveBeenCalledWith([
        'file:///cache/chosen.jpg',
      ]);
      expect(result.current.status).toBe('saved');
      // The library keeps its photo; only the picker's copy was deleted.
      expect(result.current.pickedFromLibrary).toBe(true);
    });

    it('says nothing of the library for a photo taken with the camera', async () => {
      mockTakePhoto.mockResolvedValueOnce([{ uri: 'file:///cache/taken.jpg' }]);
      recognizeAndDelete.mockResolvedValue(RECEIPT);
      const { result } = renderScan();
      await act(() => result.current.scan());

      await act(() => result.current.takePhoto());

      expect(result.current.status).toBe('saved');
      expect(result.current.pickedFromLibrary).toBe(false);
    });
  });
});
