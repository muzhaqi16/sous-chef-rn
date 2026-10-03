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

/** A page rewritten for the server to read: upright, at most 2048 px, no metadata. */
export interface PreparedPhoto {
  uri: string;
  fileSize: number;
}

type NativeMethod = 'recognizeAndDelete' | 'preparePhotos' | 'deletePhotos';

// Resolved per call, like `StartupMark`, so a module registered after this
// file loads is still found; a build older than a method lacks it.
const nativeMethod = (
  name: NativeMethod,
): ((imageUris: string[]) => Promise<unknown>) => {
  const nativeModule: unknown = NativeModules.TextRecognitionModule;
  if (!isRecord(nativeModule)) {
    throw new Error('TextRecognitionModule is not linked');
  }
  const method: unknown = nativeModule[name];
  if (typeof method !== 'function') {
    throw new Error(`TextRecognitionModule has no ${name}`);
  }
  return (imageUris: string[]) =>
    Promise.resolve(Reflect.apply(method, nativeModule, [imageUris]));
};

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

const toPhoto = (value: unknown): PreparedPhoto | null => {
  if (!isRecord(value)) return null;
  const { uri, fileSize } = value;
  return typeof uri === 'string' && typeof fileSize === 'number'
    ? { uri, fileSize }
    : null;
};

/**
 * On-device text recognition: Apple Vision on iOS, ML Kit through Play services
 * on Android, and the photos a phone that cannot read sends instead.
 */
export const TextRecognition = {
  /**
   * Recognizes each image in order, then deletes them. A failed read keeps
   * them for {@link preparePhotos} or {@link deletePhotos}.
   */
  async recognizeAndDelete(
    imageUris: readonly string[],
  ): Promise<RecognizedPage[]> {
    const pages = await nativeMethod('recognizeAndDelete')([...imageUris]);
    return Array.isArray(pages) ? pages.map(toPage) : [];
  },

  /** Rewrites each image for the server to read and deletes the originals, whatever the outcome. */
  async preparePhotos(imageUris: readonly string[]): Promise<PreparedPhoto[]> {
    const photos = await nativeMethod('preparePhotos')([...imageUris]);
    return Array.isArray(photos)
      ? photos.flatMap(photo => toPhoto(photo) ?? [])
      : [];
  },

  async deletePhotos(imageUris: readonly string[]): Promise<void> {
    await nativeMethod('deletePhotos')([...imageUris]);
  },
};
