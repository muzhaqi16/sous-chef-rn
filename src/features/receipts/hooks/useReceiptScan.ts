import { useState } from 'react';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
  type ScanDocumentResponse,
} from 'react-native-document-scanner-plugin';
import { TextRecognition, type RecognizedPage } from '#/native/TextRecognition';
import { errorService } from '#/services/errorService';
import { usePhotoCapture } from '#hooks/usePhotoCapture';
import type { ImageFile } from '#/types/media';
import { assembleReceiptLines } from '../utils/assembleReceiptLines';
import { hasItemLines } from '../utils/hasItemLines';
import { redactReceiptText } from '../utils/redactReceiptText';
import { readReceiptDate } from '../utils/receiptDate';
import { todayKey } from '#/utils/dateUtils';
import type { ParsedReceipt } from '../utils/structureReceipt';
import { parseReceiptOnDevice } from './onDeviceReceiptParser';
import {
  useReceiptDraftStore,
  type ReceiptDraft,
} from '../store/receiptDraftStore';

export type ReceiptScanStatus =
  | 'idle'
  | 'scannerUnavailable'
  | 'reading'
  | 'unreadable'
  | 'failed'
  | 'saved';

interface UseReceiptScanOptions {
  /** The user closed the scanner without a page: nothing is kept. */
  onCancel: () => void;
}

/**
 * Scan (or, where the phone has no document scanner, photograph) → recognise
 * on device → redact → keep as the draft → structure it with the phone's model
 * where there is one. The recognizer deletes the pages whatever it returns;
 * only redacted text, and what was read from it, is kept.
 */
export function useReceiptScan({ onCancel }: UseReceiptScanOptions) {
  const draft = useReceiptDraftStore(state => state.draft);
  const saveDraft = useReceiptDraftStore(state => state.saveDraft);
  const clearDraft = useReceiptDraftStore(state => state.clearDraft);
  const [phase, setStatus] = useState<ReceiptScanStatus>('idle');
  // The draft store hydrates asynchronously, so a saved draft can arrive after
  // the first render; it is read on every render, never only as a seed.
  const status = phase === 'idle' && draft ? 'saved' : phase;

  const { takePhoto: capturePhoto, pickPhoto: choosePhoto } = usePhotoCapture();

  const readPages = async (imageUris: string[]) => {
    setStatus('reading');
    let pages: RecognizedPage[];
    try {
      pages = await TextRecognition.recognizeAndDelete(imageUris);
    } catch (error) {
      errorService.reportError(error, { operation: 'Recognise receipt text' });
      setStatus('failed');
      return;
    }

    const lines = assembleReceiptLines(pages);
    // Read before redaction: receipts print the day below the payment block,
    // which redaction cuts. Only the day is kept from it.
    const purchasedOn = readReceiptDate(
      lines.map(page => page.join('\n')),
      todayKey(),
    );
    const redacted = redactReceiptText(lines);
    if (!hasItemLines(redacted)) {
      setStatus('unreadable');
      return;
    }
    const next: ReceiptDraft = {
      pages: redacted.map(page => page.join('\n')),
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
    if (parsed) saveDraft({ ...next, parsed });
    setStatus('saved');
  };

  const scan = async () => {
    let response: ScanDocumentResponse;
    try {
      response = await DocumentScanner.scanDocument({
        responseType: ResponseType.ImageFilePath,
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
      onCancel();
      return;
    }
    await readPages(images);
  };

  const readPhoto = async (photos: ImageFile[]) => {
    // A cancelled or refused photo leaves the choice on screen.
    if (photos.length === 0) return;
    await readPages(photos.map(photo => photo.uri));
  };

  const takePhoto = async () => {
    await readPhoto(await capturePhoto());
  };

  const pickPhoto = async () => {
    await readPhoto(await choosePhoto());
  };

  const discard = () => {
    clearDraft();
    setStatus('idle');
  };

  return { status, draft, scan, takePhoto, pickPhoto, discard };
}
