import { NativeModules } from 'react-native';
import { isRecord } from '#/utils/isRecord';

export interface RecognizedLine {
  text: string;
  /** The line's box as fractions of the page, origin top-left. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The text's rise per unit across, as fractions of the page; down is +. */
  slope?: number;
}

export interface RecognizedPage {
  lines: RecognizedLine[];
}

interface TextRecognitionNativeModule {
  recognizeAndDelete: (imageUris: string[]) => Promise<unknown>;
}

const isTextRecognitionModule = (
  value: unknown,
): value is TextRecognitionNativeModule =>
  isRecord(value) && typeof value.recognizeAndDelete === 'function';

const toLine = (value: unknown): RecognizedLine | null => {
  if (!isRecord(value)) return null;
  const { text, x, y, width, height, slope } = value;
  if (
    typeof text !== 'string' ||
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return null;
  }
  return typeof slope === 'number' && Number.isFinite(slope)
    ? { text, x, y, width, height, slope }
    : { text, x, y, width, height };
};

const toPage = (value: unknown): RecognizedPage => {
  const lines = isRecord(value) ? value.lines : null;
  if (!Array.isArray(lines)) return { lines: [] };
  return { lines: lines.flatMap(line => toLine(line) ?? []) };
};

/**
 * On-device text recognition: Apple Vision on iOS, ML Kit through Play services
 * on Android. Resolved per call, like `StartupMark`, so a module registered
 * after this file loads is still found.
 */
export const TextRecognition = {
  /** Recognizes each image in order, then deletes every image, even on failure. */
  async recognizeAndDelete(
    imageUris: readonly string[],
  ): Promise<RecognizedPage[]> {
    const nativeModule: unknown = NativeModules.TextRecognitionModule;
    if (!isTextRecognitionModule(nativeModule)) {
      throw new Error('TextRecognitionModule is not linked');
    }
    const pages: unknown = await nativeModule.recognizeAndDelete([
      ...imageUris,
    ]);
    return Array.isArray(pages) ? pages.map(toPage) : [];
  },
};
