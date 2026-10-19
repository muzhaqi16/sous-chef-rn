import { act } from '@testing-library/react-native';
import {
  checkReading as rulesCheckReading,
  dateOrderOf,
  readReceipt as rulesReadReceipt,
  type RulesReading,
} from '@muzhaqi16/receipt-rules';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import { TextRecognition, type RecognizedPage } from '#/native/TextRecognition';
import {
  ReceiptStructuring,
  type ReceiptLineLabels,
} from '#/native/ReceiptStructuring';
import { LABELLING_TIMEOUT_MS } from '../../utils/onDeviceStructuring';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { errorService } from '#/services/errorService';
import { Telemetry } from '#/services/telemetry';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { toDateKey } from '#/utils/dateUtils';
import { useStore } from '#store';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import { useReceiptPhotoConsentStore } from '../../store/receiptPhotoConsentStore';
import { useReceiptScan } from '../useReceiptScan';

jest.mock('#/storage/mmkv');
jest.mock('#/native/TextRecognition', () => ({
  TextRecognition: {
    recognizeAndDelete: jest.fn(),
    preparePhotos: jest.fn(),
    deletePhotos: jest.fn(),
    maskPhotos: jest.fn(),
    canMaskPhotos: jest.fn(),
  },
}));
const mockUploadUnconfirmed = jest.fn();
jest.mock('#hooks/useImageUpload', () => ({
  useImageUpload: () => ({ uploadUnconfirmed: mockUploadUnconfirmed }),
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
jest.mock('@muzhaqi16/receipt-rules', () => ({
  ...jest.requireActual('@muzhaqi16/receipt-rules'),
  readReceipt: jest.fn(),
  checkReading: jest.fn(),
  dateOrderOf: jest.fn(),
}));
// `deviceReceiptModel`, the only flag the hook reads.
jest.mock('#hooks/useFeatureFlag', () => ({ useFeatureFlag: jest.fn() }));

const scanDocument = jest.mocked(DocumentScanner.scanDocument);
const recognizeAndDelete = jest.mocked(TextRecognition.recognizeAndDelete);
const preparePhotos = jest.mocked(TextRecognition.preparePhotos);
const deletePhotos = jest.mocked(TextRecognition.deletePhotos);
const maskPhotos = jest.mocked(TextRecognition.maskPhotos);
const canMaskPhotos = jest.mocked(TextRecognition.canMaskPhotos);
const availability = jest.mocked(ReceiptStructuring.availability);
const labelLines = jest.mocked(ReceiptStructuring.labelLines);
const readReceipt = jest.mocked(rulesReadReceipt);
const checkReading = jest.mocked(rulesCheckReading);
const dateOrder = jest.mocked(dateOrderOf);
const modelFlag = jest.mocked(useFeatureFlag);

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

// Reading on the phone is off unless a test turns it on: off is today's path.
const renderScan = (serverParsing = true, deviceReading = false) => {
  const onCancel = jest.fn();
  const view = renderHookWithApollo(() =>
    useReceiptScan({ onCancel, serverParsing, deviceReading }),
  );
  return { ...view, onCancel };
};

beforeEach(() => {
  jest.clearAllMocks();
  useReceiptDraftStore.getState().clearDraft();
  availability.mockResolvedValue('unavailable');
  dateOrder.mockReturnValue('monthFirst');
  modelFlag.mockReturnValue(false);
  deletePhotos.mockResolvedValue(undefined);
  // A build that cannot mask, unless a test says otherwise.
  maskPhotos.mockResolvedValue(null);
  canMaskPhotos.mockReturnValue(false);
  useStore.setState({ isOnline: true });
  // The text path, unless a test says otherwise.
  useReceiptPhotoConsentStore.setState({ consent: 'declined' });
});

const scannedOnePage = () => {
  scanDocument.mockResolvedValue({
    status: ScanDocumentResponseStatus.Success,
    scannedImages: ['file:///page.jpg'],
  });
  recognizeAndDelete.mockResolvedValue(RECEIPT);
};

// A photo still going up when the send stops rejects as cancelled.
const untilStopped = (
  _file: unknown,
  _purpose: unknown,
  { signal }: { signal: AbortSignal },
) =>
  new Promise<string>((_resolve, reject) => {
    signal.addEventListener('abort', () =>
      reject(new Error('Upload was cancelled')),
    );
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

  // Receipts print the day under the payment block, which redaction cuts, so it
  // is read first; the rest of the cut lines still never reach the draft.
  it('keeps the day and time the receipt printed below its payment block', async () => {
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
    const { purchaseTime, ...rest } = draft ?? {};
    expect(purchaseTime).toBe('14:22');
    expect(JSON.stringify(rest)).not.toMatch(/TC#|14:22/);
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
    // The device's region, not the app's language.
    expect(dateOrder).toHaveBeenCalledWith(null);
  });

  it('says whether a photo sent to be read is masked first', () => {
    expect(renderScan().result.current.masksPhotos).toBe(false);

    canMaskPhotos.mockReturnValue(true);
    expect(renderScan().result.current.masksPhotos).toBe(true);
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

  it('asks the scanner for no more pages than go as photos', async () => {
    scannedOnePage();
    const { result } = renderScan();

    await act(() => result.current.scan());

    expect(scanDocument).toHaveBeenCalledWith(
      expect.objectContaining({ maxNumDocuments: 4 }),
    );
  });

  // iOS's scanner takes any number of pages.
  it('keeps the text of a scan longer than ten pages as ten', async () => {
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
      { length: 4 },
      (_, at) => `file:///page-${at}.jpg`,
    );

    const failedRead = async (pages = PAGES, serverParsing = true) => {
      const view = renderScan(serverParsing);
      scanDocument.mockResolvedValue({
        status: ScanDocumentResponseStatus.Success,
        scannedImages: pages,
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
      expect(mockUploadUnconfirmed).not.toHaveBeenCalled();
      expect(useReceiptDraftStore.getState().draft).toBeNull();
    });

    // iOS's scanner takes more pages than go as photos.
    it('sends no part of a longer scan, and deletes its pages', async () => {
      const pages = [...PAGES, 'file:///page-4.jpg'];
      const { result } = await failedRead(pages);

      expect(result.current.status).toBe('failed');
      expect(deletePhotos).toHaveBeenCalledWith(pages);
      expect(preparePhotos).not.toHaveBeenCalled();
      expect(mockUploadUnconfirmed).not.toHaveBeenCalled();
      expect(useReceiptDraftStore.getState().draft).toBeNull();
    });

    it('offers nothing to send, and deletes the pages, where the server reads no receipts', async () => {
      const { result } = await failedRead(PAGES, false);

      expect(result.current.status).toBe('failed');
      expect(deletePhotos).toHaveBeenCalledWith(PAGES);
      expect(mockUploadUnconfirmed).not.toHaveBeenCalled();
    });

    it('sends the photos on consent, keeps only their keys, and deletes every copy', async () => {
      const { result } = await failedRead();
      preparePhotos.mockImplementation(async uris =>
        uris.map((_, at) => ({
          uri: `file:///prepared-${at}.jpg`,
          fileSize: 900,
        })),
      );
      mockUploadUnconfirmed.mockImplementation(async (file: { uri: string }) =>
        file.uri.replace('file:///prepared', 'receipt-photos/u1/p'),
      );

      await act(() => result.current.sendPhotos());

      expect(preparePhotos).toHaveBeenCalledWith(PAGES);
      expect(mockUploadUnconfirmed).toHaveBeenCalledTimes(4);
      expect(mockUploadUnconfirmed).toHaveBeenCalledWith(
        expect.anything(),
        ImageUploadPurpose.ReceiptPhoto,
        { signal: expect.any(AbortSignal) },
      );
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

    // The second tap lands before the screen has re-rendered as sending.
    it('sends the photos once when the send is tapped twice', async () => {
      const { result } = await failedRead();
      preparePhotos.mockImplementation(async uris =>
        uris.map((_, at) => ({
          uri: `file:///prepared-${at}.jpg`,
          fileSize: 900,
        })),
      );
      mockUploadUnconfirmed.mockImplementation(async (file: { uri: string }) =>
        file.uri.replace('file:///prepared', 'receipt-photos/u1/p'),
      );

      await act(async () => {
        const { sendPhotos } = result.current;
        await Promise.all([sendPhotos(), sendPhotos()]);
      });

      expect(preparePhotos).toHaveBeenCalledTimes(1);
      expect(useReceiptDraftStore.getState().draft?.photoKeys).toHaveLength(4);
      expect(result.current.status).toBe('saved');
    });

    it('keeps nothing when a photo does not go up', async () => {
      const { result } = await failedRead();
      preparePhotos.mockResolvedValue([
        { uri: 'file:///prepared-0.jpg', fileSize: 900 },
      ]);
      mockUploadUnconfirmed.mockRejectedValueOnce(
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
      expect(mockUploadUnconfirmed).not.toHaveBeenCalled();
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

    it('saves nothing once the screen has gone, and deletes every copy', async () => {
      const { result, unmount } = await failedRead();
      preparePhotos.mockImplementation(async uris =>
        uris.map((_, at) => ({
          uri: `file:///prepared-${at}.jpg`,
          fileSize: 900,
        })),
      );
      let upload: (key: string) => void = () => {};
      mockUploadUnconfirmed.mockImplementationOnce(
        () =>
          new Promise<string>(resolve => {
            upload = resolve;
          }),
      );

      let sending: Promise<void> = Promise.resolve();
      await act(async () => {
        sending = result.current.sendPhotos();
      });
      // A later scan saved while the first photo is still going up.
      unmount();
      const later = { pages: ['LATER'], scannedAt: '2026-10-02T09:00:00Z' };
      useReceiptDraftStore.getState().saveDraft(later);
      upload('receipt-photos/u1/p-0.jpg');
      await act(() => sending);

      expect(deletePhotos).toHaveBeenCalledWith([
        'file:///prepared-0.jpg',
        'file:///prepared-1.jpg',
        'file:///prepared-2.jpg',
        'file:///prepared-3.jpg',
      ]);
      expect(useReceiptDraftStore.getState().draft).toEqual(later);
    });

    it('deletes the pages when the screen goes before the user decides', async () => {
      const { unmount } = await failedRead();

      unmount();

      expect(deletePhotos).toHaveBeenCalledWith(PAGES);
    });
  });

  describe('photos first', () => {
    const prepared = (count: number) =>
      Array.from({ length: count }, (_, at) => ({
        uri: `file:///prepared-${at}.jpg`,
        fileSize: 900,
      }));
    const uploadsAll = () =>
      mockUploadUnconfirmed.mockImplementation(async (file: { uri: string }) =>
        file.uri.replace('file:///prepared', 'receipt-photos/u1/p'),
      );
    const scannedPages = (count: number) =>
      scanDocument.mockResolvedValue({
        status: ScanDocumentResponseStatus.Success,
        scannedImages: Array.from(
          { length: count },
          (_, at) => `file:///page-${at}.jpg`,
        ),
      });

    beforeEach(() => {
      useReceiptPhotoConsentStore.setState({ consent: 'granted' });
    });

    it('asks once, online, before the first scan, then scans', async () => {
      useReceiptPhotoConsentStore.setState({ consent: null });
      scannedOnePage();
      const { result } = renderScan();

      await act(() => result.current.scan());
      expect(result.current.status).toBe('consent');
      expect(scanDocument).not.toHaveBeenCalled();

      await act(() => result.current.answerConsent('declined'));
      expect(useReceiptPhotoConsentStore.getState().consent).toBe('declined');
      expect(scanDocument).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('saved');

      await act(() => result.current.scan());
      expect(scanDocument).toHaveBeenCalledTimes(2);
    });

    // Metro's inline requires create the store in the tap's handler, before it
    // has loaded what was stored.
    it('waits for the stored answer before asking', async () => {
      useReceiptPhotoConsentStore.setState({ consent: null });
      const { persist } = useReceiptPhotoConsentStore;
      const hydrated = jest
        .spyOn(persist, 'hasHydrated')
        .mockReturnValue(false);
      const rehydrate = jest
        .spyOn(persist, 'rehydrate')
        .mockImplementation(async () => {
          useReceiptPhotoConsentStore.setState({ consent: 'declined' });
        });
      scannedOnePage();
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(rehydrate).toHaveBeenCalled();
      expect(result.current.status).not.toBe('consent');
      expect(scanDocument).toHaveBeenCalledTimes(1);
      expect(recognizeAndDelete).toHaveBeenCalled();
      hydrated.mockRestore();
      rehydrate.mockRestore();
    });

    it('neither asks nor sends photos where the server reads no receipts', async () => {
      useReceiptPhotoConsentStore.setState({ consent: null });
      scannedOnePage();
      const { result } = renderScan(false);

      await act(() => result.current.scan());

      expect(scanDocument).toHaveBeenCalledTimes(1);
      expect(preparePhotos).not.toHaveBeenCalled();
      expect(result.current.status).toBe('saved');
      expect(useReceiptPhotoConsentStore.getState().consent).toBeNull();
    });

    it('scans without asking while offline, from the text', async () => {
      useReceiptPhotoConsentStore.setState({ consent: null });
      useStore.setState({ isOnline: false });
      scannedOnePage();
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(scanDocument).toHaveBeenCalledTimes(1);
      expect(recognizeAndDelete).toHaveBeenCalled();
      expect(preparePhotos).not.toHaveBeenCalled();
      expect(useReceiptPhotoConsentStore.getState().consent).toBeNull();
    });

    it('sends the photos and keeps the text, with no on-device parse', async () => {
      modelFlag.mockReturnValue(true);
      scannedPages(2);
      preparePhotos.mockResolvedValue(prepared(2));
      recognizeAndDelete.mockResolvedValue(RECEIPT);
      uploadsAll();
      const { result } = renderScan();

      await act(() => result.current.scan());

      const pages = ['file:///page-0.jpg', 'file:///page-1.jpg'];
      // Prepared first, keeping the pages: the native side runs calls in order.
      expect(preparePhotos).toHaveBeenCalledWith(pages, { keepPages: true });
      expect(recognizeAndDelete).toHaveBeenCalledWith(pages);
      expect(preparePhotos.mock.invocationCallOrder[0]).toBeLessThan(
        recognizeAndDelete.mock.invocationCallOrder[0] ?? 0,
      );
      expect(mockUploadUnconfirmed).toHaveBeenCalledTimes(2);
      expect(deletePhotos).toHaveBeenCalledWith([
        'file:///prepared-0.jpg',
        'file:///prepared-1.jpg',
      ]);
      const draft = useReceiptDraftStore.getState().draft;
      expect(draft?.photoKeys).toEqual([
        'receipt-photos/u1/p-0.jpg',
        'receipt-photos/u1/p-1.jpg',
      ]);
      expect(draft?.pages[0]).toContain('GV WHOLE MILK');
      expect(draft?.pages[0]).not.toContain('4242');
      expect(availability).not.toHaveBeenCalled();
      expect(result.current.status).toBe('saved');
      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'receipt_scan_ready_ms',
        expect.any(Number),
        { route: 'photos', pages: '2' },
      );
    });

    it('reads more pages than the server takes as photos from their text', async () => {
      scannedPages(5);
      recognizeAndDelete.mockResolvedValue(RECEIPT);
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(preparePhotos).not.toHaveBeenCalled();
      expect(mockUploadUnconfirmed).not.toHaveBeenCalled();
      expect(useReceiptDraftStore.getState().draft?.photoKeys).toBeUndefined();
      expect(result.current.status).toBe('saved');
    });

    it('falls back to the text when a photo does not go up', async () => {
      scannedPages(1);
      preparePhotos.mockResolvedValue(prepared(1));
      recognizeAndDelete.mockResolvedValue(RECEIPT);
      mockUploadUnconfirmed.mockRejectedValueOnce(new Error('Upload failed'));
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(deletePhotos).toHaveBeenCalledWith(['file:///prepared-0.jpg']);
      const draft = useReceiptDraftStore.getState().draft;
      expect(draft?.photoKeys).toBeUndefined();
      expect(draft?.pages[0]).toContain('GV WHOLE MILK');
      expect(result.current.status).toBe('saved');
      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'receipt_scan_ready_ms',
        expect.any(Number),
        { route: 'text', pages: '1' },
      );
    });

    it('sends the photos of pages the phone could not read, without asking', async () => {
      scannedPages(1);
      preparePhotos.mockResolvedValue(prepared(1));
      recognizeAndDelete.mockRejectedValueOnce(new Error('vision failed'));
      uploadsAll();
      const { result } = renderScan();

      await act(() => result.current.scan());

      // A failed read keeps its pages; their photos are already prepared.
      expect(deletePhotos).toHaveBeenCalledWith(['file:///page-0.jpg']);
      expect(useReceiptDraftStore.getState().draft).toEqual(
        expect.objectContaining({
          pages: [],
          photoKeys: ['receipt-photos/u1/p-0.jpg'],
        }),
      );
      expect(result.current.status).toBe('saved');
    });

    it('sends no part of a long receipt the phone could not read', async () => {
      scannedPages(5);
      recognizeAndDelete.mockRejectedValueOnce(new Error('vision failed'));
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(preparePhotos).not.toHaveBeenCalled();
      expect(mockUploadUnconfirmed).not.toHaveBeenCalled();
      expect(useReceiptDraftStore.getState().draft).toBeNull();
      expect(result.current.status).toBe('failed');
    });

    it('keeps the text and records no photos when the screen goes mid-upload', async () => {
      scannedPages(2);
      preparePhotos.mockResolvedValue(prepared(2));
      recognizeAndDelete.mockResolvedValue(RECEIPT);
      let upload: (key: string) => void = () => {};
      mockUploadUnconfirmed.mockImplementationOnce(
        () =>
          new Promise<string>(resolve => {
            upload = resolve;
          }),
      );
      const { result, unmount } = renderScan();

      let scanning: Promise<void> = Promise.resolve();
      await act(async () => {
        scanning = result.current.scan();
      });
      unmount();
      upload('receipt-photos/u1/p-0.jpg');
      await act(() => scanning);

      expect(deletePhotos).toHaveBeenCalledWith([
        'file:///prepared-0.jpg',
        'file:///prepared-1.jpg',
      ]);
      const draft = useReceiptDraftStore.getState().draft;
      expect(draft?.pages[0]).toContain('GV WHOLE MILK');
      expect(draft?.photoKeys).toBeUndefined();
    });

    it('stops the other photos when one does not go up, and reads the text', async () => {
      const reportError = jest.spyOn(errorService, 'reportError');
      scannedPages(2);
      preparePhotos.mockResolvedValue(prepared(2));
      recognizeAndDelete.mockResolvedValue(RECEIPT);
      mockUploadUnconfirmed
        .mockRejectedValueOnce(new Error('Upload failed: 400'))
        .mockImplementationOnce(untilStopped);
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(mockUploadUnconfirmed).toHaveBeenCalledTimes(2);
      // Only the failure is reported, not the photo it stopped.
      expect(reportError).toHaveBeenCalledTimes(1);
      const draft = useReceiptDraftStore.getState().draft;
      expect(draft?.photoKeys).toBeUndefined();
      expect(draft?.pages[0]).toContain('GV WHOLE MILK');
      expect(result.current.status).toBe('saved');
      reportError.mockRestore();
    });

    it('gives way to the text when the photos take too long to go up', async () => {
      jest.useFakeTimers();
      scannedPages(1);
      preparePhotos.mockResolvedValue(prepared(1));
      recognizeAndDelete.mockResolvedValue(RECEIPT);
      mockUploadUnconfirmed.mockImplementationOnce(untilStopped);
      const { result } = renderScan();

      const scanning = result.current.scan();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(45_000);
        await scanning;
      });

      expect(Telemetry.increment).toHaveBeenCalledWith(
        'receipt_photo_send_timeouts_total',
      );
      expect(deletePhotos).toHaveBeenCalledWith(['file:///prepared-0.jpg']);
      const draft = useReceiptDraftStore.getState().draft;
      expect(draft?.photoKeys).toBeUndefined();
      expect(draft?.pages[0]).toContain('GV WHOLE MILK');
      expect(result.current.status).toBe('saved');
      jest.useRealTimers();
    });

    it('fails when the pages can be neither read nor prepared', async () => {
      scannedPages(1);
      preparePhotos.mockRejectedValueOnce(new Error('unreadable'));
      recognizeAndDelete.mockRejectedValueOnce(new Error('unreadable'));
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(result.current.status).toBe('failed');
      expect(deletePhotos).toHaveBeenCalledWith(['file:///page-0.jpg']);
      expect(mockUploadUnconfirmed).not.toHaveBeenCalled();
      expect(useReceiptDraftStore.getState().draft).toBeNull();
    });

    it('reads the text when the photos cannot be prepared', async () => {
      scannedPages(1);
      preparePhotos.mockRejectedValueOnce(new Error('unreadable'));
      recognizeAndDelete.mockResolvedValue(RECEIPT);
      const { result } = renderScan();

      await act(() => result.current.scan());

      expect(mockUploadUnconfirmed).not.toHaveBeenCalled();
      const draft = useReceiptDraftStore.getState().draft;
      expect(draft?.pages[0]).toContain('GV WHOLE MILK');
      expect(draft?.photoKeys).toBeUndefined();
      expect(result.current.status).toBe('saved');
    });

    it('holds the photos until the phone has read the text', async () => {
      scannedPages(1);
      preparePhotos.mockResolvedValue(prepared(1));
      let read: (pages: RecognizedPage[]) => void = () => {};
      recognizeAndDelete.mockImplementationOnce(
        () =>
          new Promise<RecognizedPage[]>(resolve => {
            read = resolve;
          }),
      );
      uploadsAll();
      const { result } = renderScan();

      let scanning: Promise<void> = Promise.resolve();
      await act(async () => {
        scanning = result.current.scan();
      });
      expect(preparePhotos).toHaveBeenCalled();
      expect(mockUploadUnconfirmed).not.toHaveBeenCalled();
      expect(result.current.status).toBe('reading');

      read(RECEIPT);
      await act(() => scanning);

      expect(mockUploadUnconfirmed).toHaveBeenCalledTimes(1);
      const draft = useReceiptDraftStore.getState().draft;
      expect(draft?.photoKeys).toEqual(['receipt-photos/u1/p-0.jpg']);
      expect(draft?.pages[0]).toContain('GV WHOLE MILK');
      expect(result.current.status).toBe('saved');
    });

    describe('masking the photos', () => {
      // Rewritten in place: the same files, now smaller.
      const masksInPlace = () =>
        maskPhotos.mockImplementation(async photos =>
          photos.map(({ uri }) => ({ uri, fileSize: 700 })),
        );

      it('paints over what the phone read before any photo goes up, and says so', async () => {
        scannedPages(1);
        preparePhotos.mockResolvedValue(prepared(1));
        recognizeAndDelete.mockResolvedValue(RECEIPT);
        masksInPlace();
        uploadsAll();
        const { result } = renderScan();

        await act(() => result.current.scan());

        expect(maskPhotos).toHaveBeenCalledWith([
          {
            uri: 'file:///prepared-0.jpg',
            masks: expect.arrayContaining([
              expect.objectContaining({ points: expect.any(Array) }),
            ]),
          },
        ]);
        expect(maskPhotos.mock.invocationCallOrder[0]).toBeLessThan(
          mockUploadUnconfirmed.mock.invocationCallOrder[0] ?? 0,
        );
        expect(mockUploadUnconfirmed).toHaveBeenCalledWith(
          expect.objectContaining({
            uri: 'file:///prepared-0.jpg',
            fileSize: 700,
          }),
          ImageUploadPurpose.ReceiptPhoto,
          expect.anything(),
        );
        const draft = useReceiptDraftStore.getState().draft;
        expect(draft?.photoKeys).toEqual(['receipt-photos/u1/p-0.jpg']);
        expect(draft?.photosMasked).toBe(true);
      });

      it('sends the photos as they are, unmarked, from a build that cannot mask', async () => {
        scannedPages(1);
        preparePhotos.mockResolvedValue(prepared(1));
        recognizeAndDelete.mockResolvedValue(RECEIPT);
        uploadsAll();
        const { result } = renderScan();

        await act(() => result.current.scan());

        const draft = useReceiptDraftStore.getState().draft;
        expect(draft?.photoKeys).toEqual(['receipt-photos/u1/p-0.jpg']);
        expect(draft?.photosMasked).toBeUndefined();
      });

      it('sends the photos unmarked when masking fails', async () => {
        const reportError = jest.spyOn(errorService, 'reportError');
        scannedPages(1);
        preparePhotos.mockResolvedValue(prepared(1));
        recognizeAndDelete.mockResolvedValue(RECEIPT);
        maskPhotos.mockRejectedValueOnce(new Error('out of memory'));
        uploadsAll();
        const { result } = renderScan();

        await act(() => result.current.scan());

        expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
          operation: 'Mask receipt photos',
        });
        const draft = useReceiptDraftStore.getState().draft;
        expect(draft?.photoKeys).toEqual(['receipt-photos/u1/p-0.jpg']);
        expect(draft?.photosMasked).toBeUndefined();
        reportError.mockRestore();
      });

      it('masks nothing, and marks nothing, when the phone read no payment block', async () => {
        scannedPages(1);
        preparePhotos.mockResolvedValue(prepared(1));
        recognizeAndDelete.mockResolvedValue([
          {
            lines: [line('WALMART', 0.05), line('GV WHOLE MILK  3.48 N', 0.1)],
          },
        ]);
        masksInPlace();
        uploadsAll();
        const { result } = renderScan();

        await act(() => result.current.scan());

        expect(maskPhotos).not.toHaveBeenCalled();
        expect(
          useReceiptDraftStore.getState().draft?.photosMasked,
        ).toBeUndefined();
      });

      it('marks nothing when the phone could not read the pages', async () => {
        scannedPages(1);
        preparePhotos.mockResolvedValue(prepared(1));
        recognizeAndDelete.mockRejectedValueOnce(new Error('vision failed'));
        masksInPlace();
        uploadsAll();
        const { result } = renderScan();

        await act(() => result.current.scan());

        expect(maskPhotos).not.toHaveBeenCalled();
        const draft = useReceiptDraftStore.getState().draft;
        expect(draft?.photoKeys).toEqual(['receipt-photos/u1/p-0.jpg']);
        expect(draft?.photosMasked).toBeUndefined();
      });
    });

    it('forgets the answer at sign-out', () => {
      resetSessionScopedStores();

      expect(useReceiptPhotoConsentStore.getState().consent).toBeNull();
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

  describe('reading on the phone first', () => {
    const MILK: RulesReading['receipt']['lines'][number] = {
      text: 'GV WHOLE MILK  3.48 N',
      kind: 'ITEM',
      product: 'GV WHOLE MILK',
      code: null,
      quantity: null,
      unit: null,
      unitPrice: null,
      amount: 3.48,
      appliesTo: null,
    };
    const read: Omit<RulesReading, 'accepted'> = {
      receipt: {
        merchant: { name: 'WALMART', storeNumber: '5260', address: null },
        purchasedOn: null,
        currency: null,
        subtotal: null,
        tax: null,
        total: 3.48,
        lines: [
          MILK,
          { ...MILK, text: 'TOTAL  3.48', kind: 'TOTAL', product: null },
        ],
      },
      warnings: [],
      header: ['WALMART'],
    };
    const addsUp: RulesReading = { ...read, accepted: true };
    const missesItsTotal: RulesReading = {
      ...read,
      accepted: false,
      reason: 'TOTALS_MISMATCH',
      counted: 3.48,
      printed: 4.05,
    };
    const prepared = [{ uri: 'file:///prepared-0.jpg', fileSize: 900 }];

    it("saves a reading that adds up as the receipt's, and asks for nothing more", async () => {
      scannedOnePage();
      readReceipt.mockReturnValue(addsUp);
      const { result } = renderScan(true, true);

      await act(() => result.current.scan());

      // The redacted pages, the text the rules' corpus holds.
      expect(readReceipt).toHaveBeenCalledWith(
        ['WALMART\nGV WHOLE MILK  3.48 N'],
        { today: toDateKey(new Date()), order: 'monthFirst' },
      );
      expect(result.current.status).toBe('saved');
      const draft = useReceiptDraftStore.getState().draft;
      expect(draft).toMatchObject({
        pages: ['WALMART\nGV WHOLE MILK  3.48 N'],
        parsedBy: 'device',
        printedStore: { name: 'WALMART', storeNumber: '5260' },
        parsed: {
          merchant: 'WALMART',
          lines: [
            expect.objectContaining({
              kind: 'item',
              product: 'GV WHOLE MILK',
              lineTotal: 3.48,
            }),
            expect.objectContaining({ kind: 'total', lineTotal: 3.48 }),
          ],
        },
      });
      // Parsed, it is not sent to the server to be read.
      expect(draft?.totalsGap).toBeUndefined();
      expect(Telemetry.histogram).toHaveBeenCalledWith(
        'receipt_scan_ready_ms',
        expect.any(Number),
        { route: 'device', pages: '1' },
      );
    });

    it('keeps only the text of a reading that does not add up', async () => {
      scannedOnePage();
      readReceipt.mockReturnValue(missesItsTotal);
      const { result } = renderScan(true, true);

      await act(() => result.current.scan());

      expect(result.current.status).toBe('saved');
      const draft = useReceiptDraftStore.getState().draft;
      expect(draft?.pages).toEqual(['WALMART\nGV WHOLE MILK  3.48 N']);
      expect(draft?.parsed).toBeUndefined();
      expect(draft?.totalsGap).toBeUndefined();
      expect(draft?.printedStore).toBeUndefined();
    });

    it('keeps a reading that misses its total, with the gap, where the server reads no receipts', async () => {
      scannedOnePage();
      readReceipt.mockReturnValue(missesItsTotal);
      const { result } = renderScan(false, true);

      await act(() => result.current.scan());

      expect(useReceiptDraftStore.getState().draft).toMatchObject({
        parsedBy: 'device',
        totalsGap: { counted: 3.48, printed: 4.05 },
        parsed: { merchant: 'WALMART' },
      });
    });

    it('reads nothing on the phone with reading on the phone off', async () => {
      scannedOnePage();
      readReceipt.mockReturnValue(addsUp);
      const { result } = renderScan(true, false);

      await act(() => result.current.scan());

      expect(readReceipt).not.toHaveBeenCalled();
      expect(useReceiptDraftStore.getState().draft?.parsed).toBeUndefined();
    });

    describe("with the phone's model", () => {
      const MODEL_LABELS: ReceiptLineLabels = {
        storeName: 'WALMART',
        lines: [
          { line: 0, label: 'header' },
          { line: 1, label: 'item', product: 'GV WHOLE MILK' },
        ],
      };
      beforeEach(() => {
        modelFlag.mockReturnValue(true);
        scannedOnePage();
        availability.mockResolvedValue('available');
        labelLines.mockResolvedValue(MODEL_LABELS);
        readReceipt.mockReturnValue(missesItsTotal);
        checkReading.mockReturnValue(missesItsTotal);
      });

      it("saves the rules' reading without waiting for the model", async () => {
        readReceipt.mockReturnValue(addsUp);
        labelLines.mockReturnValue(new Promise(() => {}));
        const { result } = renderScan(true, true);

        await act(() => result.current.scan());

        expect(availability).toHaveBeenCalled();
        expect(result.current.status).toBe('saved');
        expect(useReceiptDraftStore.getState().draft).toMatchObject({
          parsedBy: 'device',
          parsed: { merchant: 'WALMART' },
        });
        expect(checkReading).not.toHaveBeenCalled();
      });

      it("keeps the model's reading when only it adds up, held to the rules' check", async () => {
        checkReading.mockReturnValue(addsUp);
        const { result } = renderScan(true, true);

        await act(() => result.current.scan());

        expect(labelLines).toHaveBeenCalledWith([
          'WALMART',
          'GV WHOLE MILK  3.48 N',
        ]);
        expect(checkReading).toHaveBeenCalledWith(
          expect.objectContaining({
            merchant: { name: 'WALMART', storeNumber: null, address: null },
            lines: expect.arrayContaining([
              expect.objectContaining({
                kind: 'ITEM',
                product: 'GV WHOLE MILK',
                amount: 3.48,
              }),
            ]),
          }),
          ['WALMART\nGV WHOLE MILK  3.48 N'],
        );
        expect(result.current.status).toBe('saved');
        expect(useReceiptDraftStore.getState().draft).toMatchObject({
          parsedBy: 'device',
          printedStore: { name: 'WALMART', storeNumber: '5260' },
        });
      });

      it('leaves the receipt to the server when neither reading adds up', async () => {
        const { result } = renderScan(true, true);

        await act(() => result.current.scan());

        expect(checkReading).toHaveBeenCalled();
        expect(result.current.status).toBe('saved');
        const draft = useReceiptDraftStore.getState().draft;
        expect(draft?.pages).toEqual(['WALMART\nGV WHOLE MILK  3.48 N']);
        expect(draft?.parsed).toBeUndefined();
      });

      it('keeps the plain text when the model fails', async () => {
        labelLines.mockRejectedValue(new Error('model busy'));
        const reportError = jest.spyOn(errorService, 'reportError');
        const { result } = renderScan(true, true);

        await act(() => result.current.scan());

        expect(result.current.status).toBe('saved');
        expect(useReceiptDraftStore.getState().draft?.parsed).toBeUndefined();
        expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
          operation: 'Label receipt lines on device',
        });
        reportError.mockRestore();
      });

      it('stops waiting for a model that does not answer', async () => {
        jest.useFakeTimers();
        labelLines.mockReturnValue(new Promise(() => {}));
        const { result } = renderScan(true, true);

        const scanning = result.current.scan();
        await act(async () => {
          await jest.advanceTimersByTimeAsync(LABELLING_TIMEOUT_MS);
          await scanning;
        });

        expect(result.current.status).toBe('saved');
        expect(useReceiptDraftStore.getState().draft?.parsed).toBeUndefined();
        jest.useRealTimers();
      });

      it('reads by the rules alone with `deviceReceiptModel` off', async () => {
        modelFlag.mockReturnValue(false);
        const { result } = renderScan(true, true);

        await act(() => result.current.scan());

        expect(readReceipt).toHaveBeenCalled();
        expect(availability).not.toHaveBeenCalled();
        expect(labelLines).not.toHaveBeenCalled();
        expect(result.current.status).toBe('saved');
      });

      it('reads by the rules alone on a phone without a model', async () => {
        availability.mockResolvedValue('unavailable');
        const { result } = renderScan(true, true);

        await act(() => result.current.scan());

        expect(readReceipt).toHaveBeenCalled();
        expect(labelLines).not.toHaveBeenCalled();
        expect(useReceiptDraftStore.getState().draft?.parsed).toBeUndefined();
      });

      it('asks neither reader with reading on the phone off', async () => {
        const { result } = renderScan(true, false);

        await act(() => result.current.scan());

        expect(readReceipt).not.toHaveBeenCalled();
        expect(availability).not.toHaveBeenCalled();
        expect(result.current.status).toBe('saved');
      });
    });

    describe('with photo consent', () => {
      beforeEach(() => {
        useReceiptPhotoConsentStore.setState({ consent: 'granted' });
        scannedOnePage();
        preparePhotos.mockResolvedValue(prepared);
        maskPhotos.mockImplementation(async photos =>
          photos.map(({ uri }) => ({ uri, fileSize: 900 })),
        );
        mockUploadUnconfirmed.mockResolvedValue('receipt-photos/u1/p-0.jpg');
      });

      it('uploads nothing for a reading that adds up, and deletes the prepared photos', async () => {
        readReceipt.mockReturnValue(addsUp);
        const { result } = renderScan(true, true);

        await act(() => result.current.scan());

        expect(mockUploadUnconfirmed).not.toHaveBeenCalled();
        expect(maskPhotos).not.toHaveBeenCalled();
        expect(deletePhotos).toHaveBeenCalledWith(['file:///prepared-0.jpg']);
        const draft = useReceiptDraftStore.getState().draft;
        expect(draft?.photoKeys).toBeUndefined();
        expect(draft?.parsedBy).toBe('device');
        expect(result.current.status).toBe('saved');
      });

      it('sends the photos of a receipt the phone could not read', async () => {
        readReceipt.mockReturnValue(missesItsTotal);
        const { result } = renderScan(true, true);

        await act(() => result.current.scan());

        expect(mockUploadUnconfirmed).toHaveBeenCalledTimes(1);
        const draft = useReceiptDraftStore.getState().draft;
        expect(draft?.photoKeys).toEqual(['receipt-photos/u1/p-0.jpg']);
        expect(draft?.photosMasked).toBe(true);
        expect(draft?.parsed).toBeUndefined();
        expect(result.current.status).toBe('saved');
      });

      it('still gives way to the text when the photos take too long to go up', async () => {
        jest.useFakeTimers();
        readReceipt.mockReturnValue(missesItsTotal);
        mockUploadUnconfirmed.mockImplementationOnce(untilStopped);
        const { result } = renderScan(true, true);

        const scanning = result.current.scan();
        await act(async () => {
          await jest.advanceTimersByTimeAsync(45_000);
          await scanning;
        });

        expect(Telemetry.increment).toHaveBeenCalledWith(
          'receipt_photo_send_timeouts_total',
        );
        expect(
          useReceiptDraftStore.getState().draft?.photoKeys,
        ).toBeUndefined();
        expect(result.current.status).toBe('saved');
        jest.useRealTimers();
      });
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
