import { act, renderHook } from '@testing-library/react-native';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import { TextRecognition, type RecognizedPage } from '#/native/TextRecognition';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import { useReceiptScan } from '../useReceiptScan';

jest.mock('#/storage/mmkv');
jest.mock('#/native/TextRecognition', () => ({
  TextRecognition: { recognizeAndDelete: jest.fn() },
}));

const scanDocument = jest.mocked(DocumentScanner.scanDocument);
const recognizeAndDelete = jest.mocked(TextRecognition.recognizeAndDelete);

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
});

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

  it('reports a scanner or recognition failure without keeping anything', async () => {
    scanDocument.mockRejectedValueOnce(new Error('not supported'));
    const { result } = renderScan();

    await act(() => result.current.scan());
    expect(result.current.status).toBe('failed');

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
});
