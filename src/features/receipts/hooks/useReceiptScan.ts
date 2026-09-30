import { useState } from 'react';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
  type ScanDocumentResponse,
} from 'react-native-document-scanner-plugin';
import { TextRecognition, type RecognizedPage } from '#/native/TextRecognition';
import { errorService } from '#/services/errorService';
import { assembleReceiptLines } from '../utils/assembleReceiptLines';
import { hasItemLines } from '../utils/hasItemLines';
import { redactReceiptText } from '../utils/redactReceiptText';
import type { ParsedReceipt } from '../utils/structureReceipt';
import { parseReceiptOnDevice } from './onDeviceReceiptParser';
import {
  useReceiptDraftStore,
  type ReceiptDraft,
} from '../store/receiptDraftStore';

export type ReceiptScanStatus =
  | 'idle'
  | 'reading'
  | 'unreadable'
  | 'failed'
  | 'saved';

interface UseReceiptScanOptions {
  /** The user closed the scanner without a page: nothing is kept. */
  onCancel: () => void;
}

/**
 * Scan → recognise on device → redact → keep as the draft → structure it with
 * the phone's model where there is one. The pages are deleted by the recognizer
 * whatever it returns; only redacted text, and what was read from it, is kept.
 */
export function useReceiptScan({ onCancel }: UseReceiptScanOptions) {
  const draft = useReceiptDraftStore(state => state.draft);
  const saveDraft = useReceiptDraftStore(state => state.saveDraft);
  const clearDraft = useReceiptDraftStore(state => state.clearDraft);
  const [status, setStatus] = useState<ReceiptScanStatus>(
    draft ? 'saved' : 'idle',
  );

  const scan = async () => {
    let response: ScanDocumentResponse;
    try {
      response = await DocumentScanner.scanDocument({
        responseType: ResponseType.ImageFilePath,
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'Open receipt scanner' });
      setStatus('failed');
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

    setStatus('reading');
    let pages: RecognizedPage[];
    try {
      pages = await TextRecognition.recognizeAndDelete(images);
    } catch (error) {
      errorService.reportError(error, { operation: 'Recognise receipt text' });
      setStatus('failed');
      return;
    }

    const redacted = redactReceiptText(assembleReceiptLines(pages));
    if (!hasItemLines(redacted)) {
      setStatus('unreadable');
      return;
    }
    const next: ReceiptDraft = {
      pages: redacted.map(lines => lines.join('\n')),
      scannedAt: new Date().toISOString(),
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

  const discard = () => {
    clearDraft();
    setStatus('idle');
  };

  return { status, draft, scan, discard };
}
