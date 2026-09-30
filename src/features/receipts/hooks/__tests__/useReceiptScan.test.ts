import { act, renderHook } from '@testing-library/react-native';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import { TextRecognition, type RecognizedPage } from '#/native/TextRecognition';
import { ReceiptStructuring } from '#/native/ReceiptStructuring';
import { errorService } from '#/services/errorService';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import { useReceiptScan } from '../useReceiptScan';

jest.mock('#/storage/mmkv');
jest.mock('#/native/TextRecognition', () => ({
  TextRecognition: { recognizeAndDelete: jest.fn() },
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

beforeEach(() => {
  jest.clearAllMocks();
  useReceiptDraftStore.getState().clearDraft();
  availability.mockResolvedValue('unavailable');
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

  it('reports a recognition failure without keeping anything', async () => {
    const { result } = renderScan();
    scanDocument.mockResolvedValue({
      status: ScanDocumentResponseStatus.Success,
      scannedImages: ['file:///page.jpg'],
    });
    recognizeAndDelete.mockRejectedValueOnce(new Error('vision failed'));

    await act(() => result.current.scan());
    expect(result.current.status).toBe('failed');
    expect(useReceiptDraftStore.getState().draft).toBeNull();
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
    });
  });
});
