import { useEffect, useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import {
  dateOrderOf,
  readReceiptDate,
  readReceiptTime,
} from '@muzhaqi16/receipt-rules';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
  type ScanDocumentResponse,
} from 'react-native-document-scanner-plugin';
import { TextRecognition } from '#/native/TextRecognition';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { Telemetry } from '#/services/telemetry';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { usePhotoCapture } from '#hooks/device/usePhotoCapture';
import { useImageUpload } from '#hooks/data/useImageUpload';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { useIsOnline } from '#store/useAppStore';
import type { ImageFile } from '#/types/media';
import { hasItemLines } from '../utils/hasItemLines';
import { printedTimeOf } from '../utils/receiptDate';
import { MAX_PHOTOS, receiptText } from '../utils/receiptText';
import {
  checkOnPhone,
  readOnPhone,
  type PhoneReading,
} from '../utils/phoneReading';
import { todayKey } from '#/utils/dateUtils';
import { parseReceiptOnDevice } from './onDeviceReceiptParser';
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
import { uploadTogether } from '#/utils/uploadTogether';
import type { PhotoMask, PreparedPhoto } from '#/types/textRecognition';

const dropPhotos = (uris: readonly string[]) => {
  if (uris.length === 0) return;
  void TextRecognition.deletePhotos(uris).catch((error: unknown) => {
    errorService.reportError(error, { operation: 'Delete receipt photos' });
  });
};

// What `work` gives, else null with its failure reported.
const reported = async <T>(
  work: () => T | Promise<T>,
  operation: string,
): Promise<T | null> => {
  try {
    return await work();
  } catch (error) {
    errorService.reportError(error, { operation });
    return null;
  }
};

const recognize = (imageUris: readonly string[]) =>
  reported(
    () => TextRecognition.recognizeAndDelete(imageUris),
    'Recognise receipt text',
  );

const preparePhotos = (
  ...args: Parameters<typeof TextRecognition.preparePhotos>
) =>
  reported(
    () => TextRecognition.preparePhotos(...args),
    'Prepare receipt photos',
  );

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

// Past this the photos give way to the text, read and sent in seconds.
const PHOTO_SEND_LIMIT_MS = 45_000;

/** When a scan's pages came in, and how many, for `receipt_scan_ready_ms`. */
const scanStart = (pages: number) => ({ at: Date.now(), pages });

/** What the one-time consent question was asked for, run once it is answered. */
type ScanStart = 'scan' | 'photo' | 'pick';

type SavedRoute = 'photos' | 'text' | 'device';

interface UseReceiptScanOptions {
  /** The user closed the scanner without a page, with no receipt saved. */
  onCancel: () => void;
  /** The server reads receipts for this user; off, only the phone reads them. */
  serverParsing: boolean;
  /** The phone reads a receipt by the server's rules first; off, the server reads every one. */
  deviceReading: boolean;
}

/**
 * Scan → recognise, redact and read on the phone (server rules, plus its model
 * under `deviceReceiptModel`). A reading that adds up stands; else the server
 * reads photos if consented and online, or the text. The phone keeps no photo.
 */
export function useReceiptScan({
  onCancel,
  serverParsing,
  deviceReading,
}: UseReceiptScanOptions) {
  const { t } = useTranslation();
  const draft = useReceiptDraft();
  const { saveDraft, clearDraft, recordPhotoKeys } = useReceiptDraftActions();
  const client = useApolloClient();
  const deviceModel = useFeatureFlag('deviceReceiptModel');
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
  const markSaved = (route: SavedRoute) => {
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
  const textDraft = ({
    assembled,
    redacted,
    pages,
  }: ReturnType<typeof receiptText>): ReceiptDraft | null => {
    // Read before redaction: receipts print the day below the payment block,
    // which redaction cuts. Only the day and its time are kept from it.
    const unredacted = assembled.map(page => page.join('\n'));
    const today = todayKey();
    const order = dateOrderOf(null);
    const purchasedOn = readReceiptDate(unredacted, today, order);
    const purchaseTime = purchasedOn
      ? printedTimeOf(readReceiptTime(unredacted, today, order))
      : undefined;
    if (!hasItemLines(redacted)) return null;
    return {
      pages,
      scannedAt: new Date().toISOString(),
      ...(purchasedOn ? { purchasedOn } : {}),
      ...(purchaseTime ? { purchaseTime } : {}),
    };
  };

  const saveText = (next: ReceiptDraft) => {
    endSaved();
    saveDraft(next);
  };

  const withReading = (
    next: ReceiptDraft,
    { accepted: _accepted, ...reading }: PhoneReading,
  ): ReceiptDraft => ({ ...next, ...reading, parsedBy: 'device' });

  // A reader that throws reads nothing: the receipt goes on to the next.
  const readByRules = (pages: readonly string[]) =>
    reported(
      () => readOnPhone(pages, todayKey(), dateOrderOf(null)),
      'Read receipt by rules',
    );

  const readByModel = (pages: readonly string[]) =>
    reported(async () => {
      const parsed = await parseReceiptOnDevice(pages, deviceModel);
      return parsed ? checkOnPhone(parsed, pages) : null;
    }, 'Label receipt lines on device');

  // Rules and model read the pages at once; the first reading that adds up is
  // the receipt's. The model is awaited only once the rules refuse, the text
  // kept meanwhile; the rules' reading returns too, for a receipt nothing reads.
  const readOnDevice = async (next: ReceiptDraft) => {
    if (!deviceReading) {
      saveText(next);
      return { read: null, rules: null };
    }
    const modelReading = readByModel(next.pages);
    const rules = await readByRules(next.pages);
    if (rules?.accepted) return { read: rules, rules };
    saveText(next);
    const model = await modelReading;
    return { read: model?.accepted ? model : null, rules };
  };

  // `route` times the scan that read it.
  const showSaved = (library: boolean, route?: SavedRoute) => {
    setFromLibrary(library);
    setStatus('saved');
    if (route) markSaved(route);
  };

  // A receipt the phone read to its total: nothing is sent to read it.
  const keepReading = (read: ReceiptDraft, library: boolean) => {
    saveText(read);
    showSaved(library, 'device');
  };

  // A receipt the server reads from its photos alone.
  const keepPhotos = (keys: string[], masked: boolean, library: boolean) => {
    endSaved();
    saveDraft({
      pages: [],
      photoKeys: keys,
      ...(masked ? { photosMasked: true } : {}),
      scannedAt: new Date().toISOString(),
    });
    showSaved(library);
  };

  // Every photo's key, or null when one did not go up: a receipt is read whole,
  // so the first failure, or the time limit, stops the rest.
  const uploadAll = async (photos: readonly PreparedPhoto[]) => {
    if (!open.current) return null;
    return uploadTogether(
      photos.map(toUpload),
      (file, signal) =>
        uploadUnconfirmed(file, ImageUploadPurpose.ReceiptPhoto, { signal }),
      {
        limitMs: PHOTO_SEND_LIMIT_MS,
        operation: 'Upload receipt photo',
        onTimeout: () =>
          Telemetry.increment('receipt_photo_send_timeouts_total'),
      },
    );
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
    serverParsing &&
    isOnline &&
    (await storedReceiptPhotoConsent()) === 'granted';

  const readText = async (imageUris: string[], library: boolean) => {
    const recognized = await recognize(imageUris);
    if (!recognized) {
      // Only iOS's scanner takes this many, and a receipt is not sent in part;
      // nor is one the server does not read.
      if (imageUris.length > MAX_PHOTOS || !serverParsing) {
        dropPhotos(imageUris);
        setStatus('failed');
        return;
      }
      unread.current = imageUris;
      setStatus('readFailed');
      return;
    }
    const next = textDraft(receiptText(recognized));
    if (!next) {
      setStatus('unreadable');
      return;
    }
    const { read, rules } = await readOnDevice(next);
    if (read) {
      keepReading(withReading(next, read), library);
      return;
    }
    // With no server to read it, the rules' reading stands, with the gap it shows.
    if (rules && !serverParsing) saveDraft(withReading(next, rules));
    showSaved(library, 'text');
  };

  // The pages go whatever the outcome: their photos are already prepared.
  const readPreparedPages = async (imageUris: string[]) => {
    const pages = await recognize(imageUris);
    if (!pages) dropPhotos(imageUris);
    return pages;
  };

  // Each photo with its page's masks painted over it, or null when they go as
  // they are, read by the service's own model.
  const maskedPhotos = async (
    photos: readonly PreparedPhoto[],
    masks: readonly (readonly PhotoMask[])[] | null,
  ) => {
    const requests = photos.flatMap((photo, at) => {
      const shapes = masks?.[at];
      return shapes ? [{ uri: photo.uri, masks: shapes }] : [];
    });
    if (requests.length !== photos.length) return null;
    const masked = await reported(
      () => TextRecognition.maskPhotos(requests),
      'Mask receipt photos',
    );
    return masked?.length === photos.length ? masked : null;
  };

  // The photos go up only once the phone has read the same pages and could not
  // read the receipt: their masks come from the text, which stands in when
  // they cannot go up.
  const readPhotosFirst = async (imageUris: string[], library: boolean) => {
    // Asked for first: the native side prepares a scan's photos before it reads
    // them. The pages are kept for the text: nothing is deleted under it.
    const preparing = preparePhotos(imageUris, { keepPages: true });
    const pages = await readPreparedPages(imageUris);
    const read = pages ? receiptText(pages) : null;
    const next = read ? textDraft(read) : null;
    // The text is kept once read, so it survives an upload that fails.
    const reading = next ? await readOnDevice(next) : null;
    const photos = await preparing;
    if (next && reading?.read) {
      keepReading(withReading(next, reading.read), library);
      dropPhotos(photos?.map(photo => photo.uri) ?? []);
      return;
    }
    const masked = photos
      ? await maskedPhotos(photos, read?.masks ?? null)
      : null;
    const keys = photos ? await upload(masked ?? photos) : null;
    if (photos && !open.current) return;
    if (keys && next) {
      recordPhotoKeys(next.scannedAt, keys, masked !== null);
      showSaved(library, 'photos');
    } else if (keys) {
      keepPhotos(keys, masked !== null, library);
      markSaved('photos');
    } else if (next) {
      showSaved(library, 'text');
    } else {
      setStatus(pages ? 'unreadable' : 'failed');
    }
  };

  const readPages = async (imageUris: string[], library = false) => {
    setStatus('reading');
    scanStarted.current = scanStart(imageUris.length);
    // More pages than go as photos, which iOS's scanner takes, are read from
    // their text.
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
        maxNumDocuments: MAX_PHOTOS,
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

  const startOf: Record<ScanStart, () => Promise<void>> = {
    scan: openScanner,
    photo: capture,
    pick: choose,
  };
  // Asked once, online, before the first scan. The answer is kept for later
  // scans (App Settings changes it), then what it was asked for runs.
  const askConsent = (start: ScanStart) => {
    const answer = (consent: 'granted' | 'declined') => () => {
      useReceiptPhotoConsentStore.getState().setConsent(consent);
      void startOf[start]();
    };
    alertService.alert(
      t('receipts.photoConsent.title'),
      t(
        TextRecognition.canMaskPhotos()
          ? 'receipts.photoConsent.body'
          : 'receipts.photoConsent.bodyUnmasked',
      ),
      [
        // Dismissing the dialog answers it too: with the one that sends less.
        {
          text: t('receipts.photoConsent.textOnly'),
          style: 'cancel',
          onPress: answer('declined'),
        },
        { text: t('receipts.photoConsent.send'), onPress: answer('granted') },
      ],
    );
  };
  const begin = async (start: ScanStart) => {
    if (
      serverParsing &&
      isOnline &&
      (await storedReceiptPhotoConsent()) === null
    ) {
      askConsent(start);
      return;
    }
    await startOf[start]();
  };

  /** Sends the pages the phone could not read for the server to read them. */
  const sendPhotos = async () => {
    if (!isOnline) return;
    const pages = unread.current;
    // A second tap finds them taken: it must not save a receipt of no photos.
    if (pages.length === 0) return;
    unread.current = [];
    setStatus('sending');
    const photos = await preparePhotos(pages);
    if (!photos) {
      setStatus('failed');
      return;
    }
    const keys = await upload(photos);
    if (!open.current) return;
    if (keys) keepPhotos(keys, false, false);
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
    status,
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
