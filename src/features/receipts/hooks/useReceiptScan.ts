import { useEffect, useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
  type ScanDocumentResponse,
} from 'react-native-document-scanner-plugin';
import {
  TextRecognition,
  type PreparedPhoto,
  type ReadAndPrepared,
  type RecognizedPage,
} from '#/native/TextRecognition';
import { errorService } from '#/services/errorService';
import { Telemetry } from '#/services/telemetry';
import { usePhotoCapture } from '#hooks/usePhotoCapture';
import { useImageUpload } from '#hooks/useImageUpload';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { useIsOnline } from '#store/useAppStore';
import type { ImageFile } from '#/types/media';
import { hasItemLines } from '../utils/hasItemLines';
import { MAX_PAGES, MAX_PHOTOS, receiptText } from '../utils/receiptText';
import { readReceiptDate } from '../utils/receiptDate';
import { todayKey } from '#/utils/dateUtils';
import { getDeviceDateOrder } from '#/utils/deviceLocale';
import type { ParsedReceipt } from '../utils/parsedReceipt';
import { parseReceiptOnDevice } from '../utils/onDeviceReceiptParser';
import { forgetReceipt } from '../utils/forgetReceipt';
import {
  storedReceiptPhotoConsent,
  useReceiptPhotoConsentStore,
} from '../store/receiptPhotoConsentStore';
import {
  useReceiptDraft,
  useReceiptDraftActions,
  type ReceiptDraft,
} from '../store/receiptDraftStore';

const dropPhotos = (uris: readonly string[]) => {
  if (uris.length === 0) return;
  void TextRecognition.deletePhotos(uris).catch((error: unknown) => {
    errorService.reportError(error, { operation: 'Delete receipt photos' });
  });
};

const toUpload = (photo: PreparedPhoto) => ({
  uri: photo.uri,
  fileName: 'receipt.jpg',
  fileSize: photo.fileSize,
  type: 'image/jpeg',
});

export type ReceiptScanStatus =
  | 'idle'
  | 'scannerUnavailable'
  | 'reading'
  | 'unreadable'
  /** Asked once, before the first scan made online: may photos be sent? */
  | 'consent'
  /** The phone could not read it: send the photo to be read, or not. */
  | 'readFailed'
  | 'sending'
  | 'failed'
  | 'saved';

/** When a scan's pages came in, and how many, for `receipt_scan_ready_ms`. */
const scanStart = (pages: number) => ({ at: Date.now(), pages });

/** What the one-time consent question was asked for, run once it is answered. */
type ScanStart = 'scan' | 'photo' | 'pick';

interface UseReceiptScanOptions {
  /** The user closed the scanner without a page, with no receipt saved. */
  onCancel: () => void;
}

/**
 * Scan (or, where the phone has no document scanner, photograph) → recognise
 * and redact on the phone → keep as the draft. With the user's consent and a
 * connection the photos go to the server to be read, the text kept beside them
 * as the fallback; otherwise the phone's model structures the text where there
 * is one, then the server reads it. No photo stays on the phone.
 */
export function useReceiptScan({ onCancel }: UseReceiptScanOptions) {
  const draft = useReceiptDraft();
  const { saveDraft, clearDraft, recordPhotoKeys } = useReceiptDraftActions();
  const client = useApolloClient();
  // A new scan or a discard ends the saved receipt, and its lookups with it.
  const endSaved = () => {
    if (draft) forgetReceipt(client.cache, draft.serverParse?.id);
  };
  const [phase, setStatus] = useState<ReceiptScanStatus>('idle');
  // The draft store hydrates asynchronously, so a saved draft can arrive after
  // the first render; it is read on every render, never only as a seed.
  const status = phase === 'idle' && draft ? 'saved' : phase;
  // The saved receipt was read from a photo that stays in the library: the
  // recognizer deletes only the picker's copy.
  const [fromLibrary, setFromLibrary] = useState(false);

  const scanStarted = useRef<ReturnType<typeof scanStart> | null>(null);
  const markSaved = (route: 'photos' | 'text') => {
    const started = scanStarted.current;
    scanStarted.current = null;
    if (!started) return;
    Telemetry.histogram('receipt_scan_ready_ms', Date.now() - started.at, {
      route,
      pages: String(started.pages),
    });
  };

  const { takePhoto: capturePhoto, pickPhoto: choosePhoto } = usePhotoCapture();
  const { uploadUnconfirmed } = useImageUpload();
  const isOnline = useIsOnline();

  // Pages the phone could not read, kept while the user decides whether to
  // send them; deleted if the screen goes first.
  const unread = useRef<string[]>([]);
  // A send outlives a closed screen. It must not save: a later scan's draft
  // stands, and that scan's read deletes the photos still going up.
  const open = useRef(false);
  useEffect(() => {
    const held = unread;
    open.current = true;
    return () => {
      open.current = false;
      dropPhotos(held.current);
    };
  }, []);

  // The text of recognised pages as a draft; null when it holds no item lines.
  const textDraft = (recognized: RecognizedPage[]): ReceiptDraft | null => {
    const { assembled, redacted, pages } = receiptText(recognized);
    // Read before redaction: receipts print the day below the payment block,
    // which redaction cuts. Only the day is kept from it.
    const purchasedOn = readReceiptDate(
      assembled.map(page => page.join('\n')),
      todayKey(),
      getDeviceDateOrder(),
    );
    if (!hasItemLines(redacted)) return null;
    return {
      pages,
      scannedAt: new Date().toISOString(),
      ...(purchasedOn ? { purchasedOn } : {}),
    };
  };

  const saveText = (next: ReceiptDraft) => {
    endSaved();
    saveDraft(next);
  };

  // Structured with the phone's model where there is one.
  const structureOnDevice = async (next: ReceiptDraft, library: boolean) => {
    let parsed: ParsedReceipt | null = null;
    try {
      parsed = await parseReceiptOnDevice(next.pages);
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Label receipt lines on device',
      });
    }
    if (parsed) saveDraft({ ...next, parsed, parsedBy: 'device' });
    setFromLibrary(library);
    setStatus('saved');
    markSaved('text');
  };

  // A receipt the server reads from its photos alone.
  const keepPhotos = (keys: string[], library: boolean) => {
    endSaved();
    saveDraft({
      pages: [],
      photoKeys: keys,
      scannedAt: new Date().toISOString(),
    });
    setFromLibrary(library);
    setStatus('saved');
  };

  // Every photo's key, or null when one did not go up: a receipt is read whole.
  const uploadAll = async (photos: readonly PreparedPhoto[]) => {
    const keys: string[] = [];
    for (const photo of photos) {
      if (!open.current) return null;
      let key: string | null = null;
      try {
        key = await uploadUnconfirmed(
          toUpload(photo),
          ImageUploadPurpose.ReceiptPhoto,
        );
      } catch (error) {
        errorService.reportError(error, { operation: 'Upload receipt photo' });
      }
      if (!key) return null;
      keys.push(key);
    }
    return keys;
  };

  // The prepared files go whatever the outcome.
  const upload = async (photos: readonly PreparedPhoto[]) => {
    setStatus('sending');
    const keys = await uploadAll(photos);
    dropPhotos(photos.map(photo => photo.uri));
    return keys;
  };

  // A user who agreed, online: the scan's photos go to the server to be read.
  const readsPhotosFirst = async () =>
    isOnline && (await storedReceiptPhotoConsent()) === 'granted';

  const readText = async (imageUris: string[], library: boolean) => {
    let recognized: RecognizedPage[];
    try {
      recognized = await TextRecognition.recognizeAndDelete(imageUris);
    } catch (error) {
      errorService.reportError(error, { operation: 'Recognise receipt text' });
      unread.current = imageUris;
      // One who agreed to send photos is not asked again.
      if (await readsPhotosFirst()) {
        await sendPhotos();
        return;
      }
      setStatus('readFailed');
      return;
    }
    const next = textDraft(recognized);
    if (!next) {
      setStatus('unreadable');
      return;
    }
    saveText(next);
    await structureOnDevice(next, library);
  };

  // The photos go first; the text, read from the same pages, stands in when
  // they cannot go up.
  const readPhotosFirst = async (imageUris: string[], library: boolean) => {
    let read: ReadAndPrepared;
    try {
      read = await TextRecognition.recognizeAndPrepare(imageUris);
    } catch (error) {
      errorService.reportError(error, { operation: 'Read receipt pages' });
      setStatus('failed');
      return;
    }
    const next = read.pages ? textDraft(read.pages) : null;
    // Kept before the upload, so the text survives one that fails.
    if (next) saveText(next);
    const keys = read.photos ? await upload(read.photos) : null;
    if (read.photos && !open.current) return;
    if (keys && next) {
      recordPhotoKeys(next.scannedAt, keys);
      setFromLibrary(library);
      setStatus('saved');
      markSaved('photos');
    } else if (keys) {
      keepPhotos(keys, library);
      markSaved('photos');
    } else if (next) {
      await structureOnDevice(next, library);
    } else {
      setStatus(read.pages ? 'unreadable' : 'failed');
    }
  };

  const readPages = async (imageUris: string[], library = false) => {
    setStatus('reading');
    scanStarted.current = scanStart(imageUris.length);
    // More pages than the server reads as photos are read from their text.
    if (imageUris.length <= MAX_PHOTOS && (await readsPhotosFirst())) {
      await readPhotosFirst(imageUris, library);
      return;
    }
    await readText(imageUris, library);
  };

  const openScanner = async () => {
    let response: ScanDocumentResponse;
    try {
      response = await DocumentScanner.scanDocument({
        responseType: ResponseType.ImageFilePath,
        maxNumDocuments: MAX_PAGES,
      });
    } catch {
      // No document scanner here (the iOS simulator, an Android phone without
      // Play services' scanner): a plain photo still works.
      setStatus('scannerUnavailable');
      return;
    }
    const images = response.scannedImages ?? [];
    if (
      response.status !== ScanDocumentResponseStatus.Success ||
      images.length === 0
    ) {
      // Backing out of a replacement keeps the saved receipt on screen.
      if (!draft) onCancel();
      return;
    }
    await readPages(images);
  };

  const readPhoto = async (photos: ImageFile[], library: boolean) => {
    // A cancelled or refused photo leaves the choice on screen.
    if (photos.length === 0) return;
    await readPages(
      photos.map(photo => photo.uri),
      library,
    );
  };

  const capture = async () => {
    await readPhoto(await capturePhoto(), false);
  };

  const choose = async () => {
    await readPhoto(await choosePhoto(), true);
  };

  // Asked once, online, before the first scan: what it was asked for runs after.
  const [asking, setAsking] = useState<ScanStart | null>(null);
  const startOf: Record<ScanStart, () => Promise<void>> = {
    scan: openScanner,
    photo: capture,
    pick: choose,
  };
  const begin = async (start: ScanStart) => {
    if (isOnline && (await storedReceiptPhotoConsent()) === null) {
      setAsking(start);
      return;
    }
    await startOf[start]();
  };

  /** Keeps the answer for later scans, then starts what it was asked for. */
  const answerConsent = async (answer: 'granted' | 'declined') => {
    useReceiptPhotoConsentStore.getState().setConsent(answer);
    const start = asking;
    setAsking(null);
    if (start) await startOf[start]();
  };

  /** Sends the pages the phone could not read for the server to read them. */
  const sendPhotos = async () => {
    if (!isOnline) return;
    const pages = unread.current;
    unread.current = [];
    setStatus('sending');
    dropPhotos(pages.slice(MAX_PHOTOS));
    let photos: PreparedPhoto[];
    try {
      photos = await TextRecognition.preparePhotos(pages.slice(0, MAX_PHOTOS));
    } catch (error) {
      errorService.reportError(error, { operation: 'Prepare receipt photos' });
      setStatus('failed');
      return;
    }
    const keys = await upload(photos);
    if (!open.current) return;
    if (keys) keepPhotos(keys, false);
    else setStatus('failed');
  };

  /** Deletes the pages the phone could not read, sending nothing. */
  const declinePhotos = () => {
    dropPhotos(unread.current);
    unread.current = [];
    setStatus('idle');
  };

  const discard = () => {
    endSaved();
    clearDraft();
    setFromLibrary(false);
    setStatus('idle');
  };

  return {
    status: asking ? 'consent' : status,
    /** Answers the one-time question on sending photos. */
    answerConsent,
    draft,
    pickedFromLibrary: fromLibrary,
    /** Sending the photo needs a connection. */
    canSendPhotos: isOnline,
    scan: () => begin('scan'),
    takePhoto: () => begin('photo'),
    pickPhoto: () => begin('pick'),
    sendPhotos,
    declinePhotos,
    discard,
  };
}
