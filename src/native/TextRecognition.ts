import { NativeModules } from 'react-native';

export interface RecognizedLine {
  text: string;
  /** The line's box as fractions of the page, origin top-left. */
  x: number;
  y: number;
  width: number;
  height: number;
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
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'recognizeAndDelete') === 'function';

const isRecord = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;

const isNumberAt = (value: object, key: string): boolean =>
  typeof Reflect.get(value, key) === 'number';

const toLine = (value: unknown): RecognizedLine | null => {
  if (!isRecord(value)) return null;
  const text: unknown = Reflect.get(value, 'text');
  if (typeof text !== 'string') return null;
  if (!['x', 'y', 'width', 'height'].every(key => isNumberAt(value, key))) {
    return null;
  }
  return {
    text,
    x: Number(Reflect.get(value, 'x')),
    y: Number(Reflect.get(value, 'y')),
    width: Number(Reflect.get(value, 'width')),
    height: Number(Reflect.get(value, 'height')),
  };
};

const toPage = (value: unknown): RecognizedPage => {
  const lines: unknown = isRecord(value) ? Reflect.get(value, 'lines') : null;
  if (!Array.isArray(lines)) return { lines: [] };
  return {
    lines: lines.flatMap(line => toLine(line) ?? []),
  };
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
