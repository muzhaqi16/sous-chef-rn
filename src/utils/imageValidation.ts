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
  code: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'UNKNOWN_ERROR';
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
