import { isRecord } from '#/utils/isRecord';
import { nativeMethod, parseList } from './nativeModule';

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

/** A receipt's pages read and prepared in one pass: null for a half that failed. */
export interface ReadAndPrepared {
  pages: RecognizedPage[] | null;
  photos: PreparedPhoto[] | null;
}

type NativeMethod =
  | 'recognizeAndDelete'
  | 'recognizeAndPrepare'
  | 'preparePhotos'
  | 'deletePhotos';

// A build older than a method lacks it.
const call = async (
  name: NativeMethod,
  imageUris: readonly string[],
): Promise<unknown> => {
  const method = nativeMethod('TextRecognitionModule', name);
  if (!method) {
    throw new Error(`TextRecognitionModule is not linked or has no ${name}`);
  }
  return method([...imageUris]);
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

const toPage = (value: unknown): RecognizedPage => ({
  lines: parseList(isRecord(value) ? value.lines : null, toLine),
});

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
    return parseList(await call('recognizeAndDelete', imageUris), toPage);
  },

  /**
   * Recognizes each image and rewrites it for the server to read, from the same
   * full-size image, then deletes the originals. Rejects only when both fail.
   */
  async recognizeAndPrepare(
    imageUris: readonly string[],
  ): Promise<ReadAndPrepared> {
    const result = await call('recognizeAndPrepare', imageUris);
    const pages = isRecord(result) ? result.pages : null;
    const photos = isRecord(result) ? result.photos : null;
    return {
      pages: Array.isArray(pages) ? parseList(pages, toPage) : null,
      photos: Array.isArray(photos) ? parseList(photos, toPhoto) : null,
    };
  },

  /** Rewrites each image for the server to read and deletes the originals, whatever the outcome. */
  async preparePhotos(imageUris: readonly string[]): Promise<PreparedPhoto[]> {
    return parseList(await call('preparePhotos', imageUris), toPhoto);
  },

  async deletePhotos(imageUris: readonly string[]): Promise<void> {
    await call('deletePhotos', imageUris);
  },
};
