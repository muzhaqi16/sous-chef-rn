import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import {
  validateImageFile,
  getMimeTypeFromUri,
  normalizeImageMimeType,
  sniffImageMimeType,
  createImageValidationError,
} from '#utils/imageValidation';
import { useMutation } from '@apollo/client/react';
import {
  CreateImageUploadUrlDocument,
  ConfirmProfileImageUploadDocument,
  ConfirmItemImageUploadDocument,
} from '#operations/image/imageUpload.generated';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { toImagePerspective } from '#utils/imageUtils';
import {
  MAX_IMAGE_SIZE,
  MAX_PROFILE_SIZE,
  type ImageValidationError,
} from '#utils/imageValidation';
import { useStore } from '#store';
import {
  isRateLimitError,
  getRateLimitMessage,
} from '#/utils/errors/rateLimit';
import { logger } from '#/utils/environment';
import type { Translate } from '#/i18n/types';

/**
 * An upload failure whose message is already localized and safe to show. Used
 * for the presign rate limit, where the server's `retryAfter` is the whole
 * point of the message and the generic copy would discard it.
 */
class UserFacingUploadError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string) {
    super(userMessage);
    this.userMessage = userMessage;
  }
}

/**
 * The ONE mapping from an upload failure to copy a user can act on — exported
 * because `validateImageFile` raises the same codes at pick time. `error.message`
 * is NEVER shown: those are English control-flow signals. Branch on
 * `ImageValidationError.code`, never on message text, which shares no wording.
 */
export const imageErrorMessage = (
  t: Translate,
  error: unknown,
  isProfileImage: boolean,
): string => {
  // Already-localized copy wins — it carries detail (like a retry countdown)
  // that none of the code branches below can reconstruct.
  if (error instanceof UserFacingUploadError) return error.userMessage;

  const code = (error as Partial<ImageValidationError> | null)?.code;
  switch (code) {
    case 'INVALID_TYPE':
      return t('imageUpload.invalidTypeBody');
    case 'FILE_TOO_LARGE':
      return isProfileImage
        ? t('imageUpload.profileTooLargeBody', {
            size: MAX_PROFILE_SIZE / 1024 / 1024,
          })
        : t('imageUpload.itemTooLargeBody', {
            size: MAX_IMAGE_SIZE / 1024 / 1024,
          });
    case 'CONTENT_MISMATCH':
      return t('imageUpload.contentMismatchBody');
    case 'UNKNOWN_ERROR':
      return t('imageUpload.unreadableBody');
    default:
      return t('imageUpload.failedBody');
  }
};

/**
 * A confirm refusal, coded so {@link imageErrorMessage} can name the cause. The
 * server checks the uploaded object's magic bytes against the extension its key
 * was minted for and reports a mismatch as a field error on `key` — a field the
 * person never filled in, so it needs copy about the FILE they picked.
 */
function confirmRefusalError(
  payload: { __typename?: string; field?: string | null } | null | undefined,
): ImageValidationError {
  const isByteMismatch =
    payload?.__typename === 'ValidationError' &&
    payload.field?.split('.').pop() === 'key';
  return createImageValidationError(
    isByteMismatch
      ? 'Uploaded bytes do not match the key extension'
      : 'Failed to confirm upload',
    isByteMismatch ? 'CONTENT_MISMATCH' : 'UNKNOWN_ERROR',
  );
}

export interface ImageFile {
  uri: string;
  fileName?: string;
  fileSize?: number;
  type?: string;
}

export interface PresignedUploadData {
  url: string;
  key: string;
  /** The presigned POST policy — opaque to us, forwarded verbatim. */
  fields: ReadonlyArray<{ name: string; value: string }>;
}

export interface ImageUploadOptions {
  onProgress?: (progress: number) => void;
  onSuccess?: (imageUrl: string) => void;
  onError?: (error: Error) => void;
  /**
   * Skip the per-call failure alert. Set by batch callers that report once for
   * the whole run. Lives here rather than on the item-specific options because
   * `uploadImage`'s offline short-circuit must honour it too — that branch
   * alerts before any item-specific code runs.
   */
  suppressAlert?: boolean;
}

export interface ItemImageUploadOptions extends ImageUploadOptions {
  /**
   * Which angle the photo shows ('front', 'nutrition_label', …). Drives the
   * gallery's ordering and its per-photo label; an untagged photo sorts last.
   */
  perspective?: string;
  /**
   * Make this photo the item's hero. Honoured only once APPROVED and only if
   * the caller may edit the item, so a PENDING submission to someone else's
   * catalog item keeps the existing hero. A first photo becomes primary anyway,
   * so this only matters when repointing a gallery that already has one.
   */
  makePrimary?: boolean;
}

export const useImageUpload = () => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  // Abort any pending upload on unmount.
  useEffect(() => {
    return () => {
      if (activeXhrRef.current) {
        activeXhrRef.current.abort();
        activeXhrRef.current = null;
      }
    };
  }, []);

  const [createUploadUrl] = useMutation(CreateImageUploadUrlDocument);
  const [confirmProfileUpload] = useMutation(ConfirmProfileImageUploadDocument);
  const [confirmItemUpload] = useMutation(ConfirmItemImageUploadDocument);
  const [updateProfile] = useMutation(UpdateUserProfileDocument);

  /**
   * Presigned POST to object storage. `uploadData.fields` MUST be appended
   * before the file, and the file part must be named `file` and come last —
   * storage answers 400 otherwise. Content-Type is deliberately unset, so the
   * runtime authors a boundary matching the body.
   */
  const uploadToObjectStorage = async (
    file: ImageFile,
    uploadData: PresignedUploadData,
    // The type the KEY was minted for. The bytes must go up labelled the same
    // way, or object storage stores a content-type the confirm step then reads
    // back as a mismatch.
    mimeType: string,
    onProgress?: (progress: number) => void,
  ): Promise<void> => {
    const form = new FormData();
    for (const field of uploadData.fields) {
      form.append(field.name, field.value);
    }
    // RN's FormData streams a file from disk given `{ uri, type, name }`.
    form.append('file', {
      uri: file.uri,
      type: mimeType,
      name: file.fileName || 'image.jpg',
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Store reference for cleanup on unmount
      activeXhrRef.current = xhr;

      xhr.onload = () => {
        activeXhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          // 400 here is a policy violation — oversized body or a mime that
          // doesn't match the one the presign was issued for. Log the status
          // only: the presigned URL and the response body can carry signed
          // request context, so they stay out of the logs.
          logger.error(`Image upload failed: status=${xhr.status}`);
          const statusText = xhr.statusText ? ` ${xhr.statusText}` : '';
          reject(new Error(`Upload failed: ${xhr.status}${statusText}`));
        }
      };

      xhr.onerror = () => {
        activeXhrRef.current = null;
        reject(new Error('Network request failed during upload'));
      };

      xhr.ontimeout = () => {
        activeXhrRef.current = null;
        reject(new Error('Upload request timed out'));
      };

      xhr.onabort = () => {
        activeXhrRef.current = null;
        reject(new Error('Upload was cancelled'));
      };

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = event => {
          if (event.lengthComputable) {
            const uploadProgress = event.loaded / event.total;
            onProgress(uploadProgress);
          }
        };
      }

      xhr.open('POST', uploadData.url);
      xhr.timeout = 60000; // 60 second timeout
      xhr.send(form);
    });
  };

  const uploadImage = async (
    file: ImageFile,
    purpose: ImageUploadPurpose,
    isProfileImage: boolean,
    itemId: string | undefined,
    confirmUploadFn: (key: string) => Promise<string | null>,
    options: ImageUploadOptions = {},
  ): Promise<string | null> => {
    const { onProgress, onSuccess, onError, suppressAlert } = options;

    // Check if online before attempting upload
    const state = useStore.getState();
    if (!state.isOnline) {
      // UserFacingUploadError, not a bare Error: being offline is fatal for a
      // whole batch, and the batch runner recognises this type as "stop now".
      // Every remaining photo would take this same branch and alert again.
      const offlineError = new UserFacingUploadError(
        t('imageUpload.offlineBody'),
      );
      onError?.(offlineError);
      if (!suppressAlert) {
        alertService.alert(
          t('imageUpload.offlineTitle'),
          t('imageUpload.offlineBody'),
        );
      }
      return null;
    }

    setUploading(true);
    setProgress(0);

    // Held in a local runner so the try below contains a single plain call —
    // the React Compiler bails out of this hook when a `?.`/`??`/ternary sits
    // inside a try body. The catch still covers the whole body, and still
    // rethrows so callers see the failure.
    const runUpload = async () => {
      // For profile images, handle missing file size gracefully
      let fileToUpload = { ...file };
      if (isProfileImage && !fileToUpload.fileSize) {
        logger.warn('File size missing, attempting to determine it...');
        logger.warn('Proceeding without file size - server will validate');
      }

      // Validate the image file
      validateImageFile(fileToUpload, isProfileImage);

      onProgress?.(10);

      // Presign for the type the file's BYTES say it is: confirm checks magic
      // bytes against the key's extension, so presigning from the picker's
      // report refuses the upload only after the whole file has transferred.
      // An unreadable head falls back to the reported type rather than
      // blocking the upload; 'image/jpg' is normalized either way.
      const sniffed = await sniffImageMimeType(fileToUpload.uri);
      if (!sniffed) {
        // Deliberately NOT a refusal. A head that cannot be read means the
        // bytes are unsupported OR the platform could not slice the blob, and
        // both arrive as the same `Network request failed` — so refusing here
        // would block legitimate uploads on any platform that cannot read a
        // head. The server still checks the bytes; this only loses the early
        // warning. See docs/verified-library-behaviour.md.
        logger.warn(
          'Image type not determined from bytes; using reported type',
        );
      }
      const mimeType =
        sniffed ??
        normalizeImageMimeType(
          fileToUpload.type || getMimeTypeFromUri(fileToUpload.uri),
        );
      const { data: uploadData, error: uploadUrlError } = await createUploadUrl(
        {
          variables: {
            input: {
              mime: mimeType,
              purpose: purpose,
              itemId: itemId,
            },
          },
        },
      );

      const uploadPayload = uploadData?.createImageUploadUrl;
      if (uploadPayload?.__typename !== 'CreateImageUploadUrlPayload') {
        // Presign has its own per-user ceiling, and it arrives as a top-level
        // GraphQL error rather than a member of the result union — so it
        // lands here with no payload. Without this branch the user is told
        // the upload simply failed and the server's retryAfter is discarded.
        if (isRateLimitError(uploadUrlError)) {
          throw new UserFacingUploadError(getRateLimitMessage(uploadUrlError));
        }
        throw new Error('Failed to get upload URL');
      }
      const uploadResult = uploadPayload;

      onProgress?.(30);

      // Step 2: Upload the bytes with the presigned POST
      await uploadToObjectStorage(
        fileToUpload,
        uploadResult,
        mimeType,
        uploadProgress => {
          onProgress?.(30 + uploadProgress * 0.5);
        },
      );

      onProgress?.(80);

      // Step 3: Confirm upload
      const finalImageUrl = await confirmUploadFn(uploadResult.key);
      if (!finalImageUrl) {
        throw new Error('Failed to confirm upload');
      }

      onProgress?.(100);
      onSuccess?.(finalImageUrl);

      setUploading(false);
      setProgress(0);
      return finalImageUrl;
    };

    let result;
    try {
      result = await runUpload();
    } catch (error) {
      setUploading(false);
      setProgress(0);
      throw error;
    }

    return result || null;
  };

  const uploadProfileImage = async (
    file: ImageFile,
    purpose: ImageUploadPurpose = ImageUploadPurpose.ProfileAvatar,
    options: ImageUploadOptions = {},
  ): Promise<string | null> => {
    let result;
    try {
      result = await uploadImage(
        file,
        purpose,
        true,
        undefined,
        async (key: string) => {
          const { data } = await confirmProfileUpload({
            variables: { input: { key } },
          });
          const payload = data?.confirmProfileImageUpload;
          if (payload?.__typename === 'ConfirmProfileImageUploadPayload') {
            return payload.url;
          }
          throw confirmRefusalError(payload);
        },
        options,
      );
    } catch (error) {
      logger.error('Profile image upload failed:', error);
      const userErrorMessage = imageErrorMessage(t, error, true);
      options.onError?.(new Error(userErrorMessage));
      alertService.alert(t('errors.uploadFailedTitle'), userErrorMessage);
    }
    return result || null;
  };

  const uploadItemImage = async (
    file: ImageFile,
    itemId: string,
    options: ItemImageUploadOptions = {},
  ): Promise<string | null> => {
    // The angle and the hero flag are both set on confirm, not on the presign:
    // until the object is confirmed there is no ItemImage row to tag.
    const perspective = toImagePerspective(options.perspective);
    const { makePrimary } = options;
    let result;
    try {
      result = await uploadImage(
        file,
        ImageUploadPurpose.ItemImage,
        false,
        itemId,
        async (key: string) => {
          const { data } = await confirmItemUpload({
            variables: {
              input: { itemId, key, perspective, makePrimary },
            },
          });
          const payload = data?.confirmItemImageUpload;
          if (payload?.__typename === 'ConfirmItemImageUploadPayload') {
            return payload.url;
          }
          throw confirmRefusalError(payload);
        },
        options,
      );
    } catch (error) {
      logger.error('Item image upload failed:', error);
      const errorMessage = imageErrorMessage(t, error, false);
      // Forward the original when it is already user-facing: `uploadItemImages`
      // needs to tell a rate limit (retry later, stop now) apart from one bad
      // file (skip it, keep going).
      options.onError?.(
        error instanceof UserFacingUploadError
          ? error
          : new Error(errorMessage),
      );
      if (!options.suppressAlert) {
        alertService.alert(t('errors.uploadFailedTitle'), errorMessage);
      }
    }
    return result || null;
  };

  /**
   * Sequential multi-angle upload. Presign caps at 20/minute and 100/hour, and a
   * rate-limit or an outage means every remaining photo fails identically — so
   * the run stops and reports ONCE; any other failure just skips that photo.
   * Returns what actually uploaded, so callers MUST check the length.
   */
  const uploadItemImages = async (
    files: Array<ImageFile & { perspective?: string; isPrimary?: boolean }>,
    itemId: string,
    options: ImageUploadOptions = {},
  ): Promise<Array<{ imageUrl: string; perspective: string }>> => {
    const results: Array<{ imageUrl: string; perspective: string }> = [];
    let fatal: UserFacingUploadError | null = null;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const index = i;
      const imageUrl = await uploadItemImage(file, itemId, {
        onProgress: p => options?.onProgress?.((index + p) / files.length),
        perspective: file.perspective,
        makePrimary: file.isPrimary,
        suppressAlert: true,
        onError: error => {
          if (error instanceof UserFacingUploadError) fatal = error;
        },
      });
      if (imageUrl) {
        results.push({ imageUrl, perspective: file.perspective || 'front' });
      }
      if (fatal) break;
    }

    if (fatal) {
      const remaining = files.length - results.length;
      options.onError?.(fatal);
      alertService.alert(
        t('errors.uploadFailedTitle'),
        t('imageUpload.batchThrottledBody', {
          count: remaining,
          reason: (fatal as UserFacingUploadError).userMessage,
        }),
      );
    } else if (results.length < files.length) {
      options.onError?.(new Error('Some images failed to upload'));
      alertService.alert(
        t('errors.uploadFailedTitle'),
        t('imageUpload.batchPartialBody', {
          count: files.length - results.length,
        }),
      );
    }

    return results;
  };

  const updateProfileAvatarUrl = async (avatarUrl: string) => {
    let result;
    try {
      result = await updateProfile({
        variables: { input: { avatar: avatarUrl } },
      });
    } catch (error) {
      logger.error('Update profile avatar failed:', error);
    }

    // `errorPolicy: 'all'` means a failed mutation RESOLVES with `error` set and
    // a non-success union member — it does not reject. The catch above only
    // fires when a link itself throws. Both outcomes land here, so the failure
    // is reported once, in the one place that sees every failure.
    const payload = result?.data?.updateProfile;
    if (payload?.__typename !== 'UpdateProfilePayload') {
      logger.error('Update profile avatar failed:', result?.error ?? payload);
      alertService.alert(
        t('imageUpload.updateFailedTitle'),
        t('imageUpload.avatarUpdateFailedBody'),
      );
      return null;
    }

    // Sync avatar to Zustand store so screens reading from the store
    // (e.g. Pantry header) reflect the change immediately.
    useStore.getState().updateUser({ profilePicture: avatarUrl });
    return payload.userProfile;
  };

  const updateProfileCoverUrl = async (coverImageUrl: string) => {
    let result;
    try {
      result = await updateProfile({
        variables: { input: { coverImage: coverImageUrl } },
      });
    } catch (error) {
      logger.error('Update profile cover failed:', error);
    }

    const payload = result?.data?.updateProfile;
    if (payload?.__typename !== 'UpdateProfilePayload') {
      logger.error('Update profile cover failed:', result?.error ?? payload);
      alertService.alert(
        t('imageUpload.updateFailedTitle'),
        t('imageUpload.coverUpdateFailedBody'),
      );
      return null;
    }
    return payload.userProfile;
  };

  return {
    uploading,
    progress,
    uploadProfileImage,
    uploadItemImage,
    uploadItemImages,
    updateProfileAvatarUrl,
    updateProfileCoverUrl,
  };
};
