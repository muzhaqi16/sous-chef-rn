import { useEffect, useRef, useState } from 'react';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
  type ScanDocumentResponse,
} from 'react-native-document-scanner-plugin';
import {
  TextRecognition,
  type PreparedPhoto,
  type RecognizedPage,
} from '#/native/TextRecognition';
import { errorService } from '#/services/errorService';
import { usePhotoCapture } from '#hooks/usePhotoCapture';
import { useImageUpload } from '#hooks/useImageUpload';
import { useIsOnline } from '#store/useAppStore';
import type { ImageFile } from '#/types/media';
import { assembleReceiptLines } from '../utils/assembleReceiptLines';
import { hasItemLines } from '../utils/hasItemLines';
import { redactReceiptText } from '../utils/redactReceiptText';
import { readReceiptDate } from '../utils/receiptDate';
import { todayKey } from '#/utils/dateUtils';
import { getDeviceDateOrder } from '#/utils/deviceLocale';
import type { ParsedReceipt } from '../utils/structureReceipt';
import { parseReceiptOnDevice } from '../utils/onDeviceReceiptParser';
import {
  useReceiptDraft,
  useReceiptDraftActions,
  type ReceiptDraft,
} from '../store/receiptDraftStore';

// The most pages the API reads. Android's scanner stops at it; iOS's takes any
// number, so the text of later shots continues the last page sent.
const MAX_PAGES = 10;

const capPages = (pages: string[]) =>
  pages.length <= MAX_PAGES
    ? pages
    : [...pages.slice(0, MAX_PAGES - 1), pages.slice(MAX_PAGES - 1).join('\n')];

// The most photos the API reads of one receipt.
const MAX_PHOTOS = 4;

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
  /** The phone could not read it: send the photo to be read, or not. */
  | 'readFailed'
  | 'sending'
  | 'failed'
  | 'saved';

interface UseReceiptScanOptions {
  /** The user closed the scanner without a page, with no receipt saved. */
  onCancel: () => void;
}

/**
 * Scan (or, where the phone has no document scanner, photograph) → recognise
 * on device → redact → keep as the draft → structure it with the phone's model
 * where there is one. Only redacted text, and what was read from it, is kept.
 * A phone that cannot read the pages sends them as photos, with consent; they
 * are deleted on the phone either way.
 */
export function useReceiptScan({ onCancel }: UseReceiptScanOptions) {
  const draft = useReceiptDraft();
  const { saveDraft, clearDraft } = useReceiptDraftActions();
  const [phase, setStatus] = useState<ReceiptScanStatus>('idle');
  // The draft store hydrates asynchronously, so a saved draft can arrive after
  // the first render; it is read on every render, never only as a seed.
  const status = phase === 'idle' && draft ? 'saved' : phase;
  // The saved receipt was read from a photo that stays in the library: the
  // recognizer deletes only the picker's copy.
  const [fromLibrary, setFromLibrary] = useState(false);

  const { takePhoto: capturePhoto, pickPhoto: choosePhoto } = usePhotoCapture();
  const { uploadReceiptPhoto } = useImageUpload();
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

  const readPages = async (imageUris: string[], library = false) => {
    setStatus('reading');
    let pages: RecognizedPage[];
    try {
      pages = await TextRecognition.recognizeAndDelete(imageUris);
    } catch (error) {
      errorService.reportError(error, { operation: 'Recognise receipt text' });
      unread.current = imageUris;
      setStatus('readFailed');
      return;
    }

    const lines = assembleReceiptLines(pages);
    // Read before redaction: receipts print the day below the payment block,
    // which redaction cuts. Only the day is kept from it.
    const purchasedOn = readReceiptDate(
      lines.map(page => page.join('\n')),
      todayKey(),
      getDeviceDateOrder(),
    );
    const redacted = redactReceiptText(lines);
    if (!hasItemLines(redacted)) {
      setStatus('unreadable');
      return;
    }
    const next: ReceiptDraft = {
      pages: capPages(redacted.map(page => page.join('\n'))),
      scannedAt: new Date().toISOString(),
      ...(purchasedOn ? { purchasedOn } : {}),
    };
    saveDraft(next);

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
  };

  const scan = async () => {
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

  const takePhoto = async () => {
    await readPhoto(await capturePhoto(), false);
  };

  const pickPhoto = async () => {
    await readPhoto(await choosePhoto(), true);
  };

  // Every photo's key, or null when one did not go up: a receipt is read whole.
  const uploadAll = async (photos: readonly PreparedPhoto[]) => {
    const keys: string[] = [];
    for (const photo of photos) {
      if (!open.current) return null;
      let key: string | null = null;
      try {
        key = await uploadReceiptPhoto(toUpload(photo));
      } catch (error) {
        errorService.reportError(error, { operation: 'Upload receipt photo' });
      }
      if (!key) return null;
      keys.push(key);
    }
    return keys;
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
    const keys = await uploadAll(photos);
    dropPhotos(photos.map(photo => photo.uri));
    if (!open.current) return;
    if (!keys) {
      setStatus('failed');
      return;
    }
    saveDraft({
      pages: [],
      photoKeys: keys,
      scannedAt: new Date().toISOString(),
    });
    setFromLibrary(false);
    setStatus('saved');
  };

  /** Deletes the pages the phone could not read, sending nothing. */
  const declinePhotos = () => {
    dropPhotos(unread.current);
    unread.current = [];
    setStatus('idle');
  };

  const discard = () => {
    clearDraft();
    setFromLibrary(false);
    setStatus('idle');
  };

  return {
    status,
    draft,
    pickedFromLibrary: fromLibrary,
    /** Sending the photo needs a connection. */
    canSendPhotos: isOnline,
    scan,
    takePhoto,
    pickPhoto,
    sendPhotos,
    declinePhotos,
    discard,
  };
}
