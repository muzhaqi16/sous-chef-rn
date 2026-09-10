// 'image/jpg' is accepted from pickers (some Android providers report it) but
// is NOT a valid upload mime — the API accepts only jpeg/png/webp. Normalize
// via normalizeImageMimeType before sending to createImageUploadUrl.
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

/**
 * Map a picker-reported mime to the API's accepted set (`image/jpeg`,
 * `image/png`, `image/webp`). The server validates `createImageUploadUrl.mime`
 * against exactly that set, so the non-standard `image/jpg` must become
 * `image/jpeg` before the mutation.
 */
export const normalizeImageMimeType = (mimeType: string): string =>
  mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_PROFILE_SIZE = 2 * 1024 * 1024; // 2MB

export interface ImageValidationError extends Error {
  code:
    | 'INVALID_TYPE'
    | 'FILE_TOO_LARGE'
    | 'UNKNOWN_ERROR'
    // The server read the uploaded object's magic bytes and they did not match
    // the extension its key was minted for. A problem with the FILE the person
    // picked, not a transient upload failure — and not a `key` they filled in.
    | 'CONTENT_MISMATCH';
}

/**
 * `message` is LOG text, deliberately English — it goes to
 * `errorService.reportError` and must NEVER be displayed. `code` is the half
 * that maps to copy, via `imageErrorMessage` in `#hooks/useImageUpload`. A
 * display site reading `.message` is caught by the `.eslintrc.js` sink selector.
 */
export const createImageValidationError = (
  message: string,
  code: ImageValidationError['code'],
): ImageValidationError => {
  const error = new Error(message) as ImageValidationError;
  error.code = code;
  return error;
};

export const validateImageFile = (
  file: {
    type?: string;
    size?: number;
    fileSize?: number; // react-native-image-picker uses fileSize
    fileName?: string;
  },
  isProfile: boolean = false,
): void => {
  // Get the mime type from type or infer from fileName
  const mimeType = file.type || inferMimeTypeFromFileName(file.fileName);

  if (!mimeType || !ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw createImageValidationError(
      'Only JPEG, PNG, and WebP images are allowed',
      'INVALID_TYPE',
    );
  }

  // Get file size - react-native-image-picker uses fileSize, web uses size
  const fileSize = file.fileSize || file.size;
  if (!fileSize) {
    throw createImageValidationError(
      'Unable to determine file size',
      'UNKNOWN_ERROR',
    );
  }

  const maxSize = isProfile ? MAX_PROFILE_SIZE : MAX_IMAGE_SIZE;
  const maxSizeMB = maxSize / 1024 / 1024;

  if (fileSize > maxSize) {
    throw createImageValidationError(
      `File too large. Maximum size: ${maxSizeMB}MB`,
      'FILE_TOO_LARGE',
    );
  }
};

const inferMimeTypeFromFileName = (fileName?: string): string | null => {
  if (!fileName) return null;

  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
};

export const getMimeTypeFromUri = (uri: string): string => {
  const extension = uri.split('.').pop()?.toLowerCase();
  return inferMimeTypeFromFileName(`file.${extension}`) || 'image/jpeg';
};

/**
 * How many leading bytes the signatures below need. WebP's is the longest: the
 * 4-byte "RIFF", 4 bytes of length, then "WEBP".
 */
const SIGNATURE_BYTES = 12;

/**
 * Magic-byte signatures for the three types the API accepts, as byte arrays with
 * `null` for "any byte here".
 */
const SIGNATURES: Array<{ mime: string; bytes: Array<number | null> }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  {
    mime: 'image/png',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    // "RIFF" .... "WEBP"
    mime: 'image/webp',
    bytes: [
      0x52,
      0x49,
      0x46,
      0x46,
      null,
      null,
      null,
      null,
      0x57,
      0x45,
      0x42,
      0x50,
    ],
  },
];

function matchSignature(bytes: Uint8Array): string | null {
  for (const { mime, bytes: signature } of SIGNATURES) {
    if (bytes.length < signature.length) continue;
    const matches = signature.every(
      (byte, i) => byte === null || bytes[i] === byte,
    );
    if (matches) return mime;
  }
  return null;
}

/**
 * Leading bytes out of a `data:` URL's base64 payload. Bare `atob`, not
 * `global.atob`: `global` is not bound in every Hermes scope (absent on an
 * SM-S908U1 while `atob` resolved), and the caller reads a throw as
 * "unreadable", so the failure would be silent.
 */
function bytesFromDataUrl(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return null;
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(Math.min(binary.length, SIGNATURE_BYTES));
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * The image type a file's BYTES say it is, or null when unreadable. A reported
 * type can disagree, and confirm refuses the mismatch only AFTER the transfer.
 * Null rather than a throw, so a platform that cannot slice still uploads.
 */
export const sniffImageMimeType = async (
  uri: string,
): Promise<string | null> => {
  let dataUrl: string | undefined;
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const head = blob.slice(0, SIGNATURE_BYTES);
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onloadend = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(head);
    });
  } catch {
    return null;
  }

  let bytes: Uint8Array | null = null;
  try {
    bytes = bytesFromDataUrl(dataUrl);
  } catch {
    return null;
  }
  return bytes ? matchSignature(bytes) : null;
};
