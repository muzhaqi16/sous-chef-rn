import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { alertService } from '#/services/alertService';
import { validateImageFile, getMimeTypeFromUri } from '#utils/imageValidation';
import { useMutation } from '@apollo/client/react';
import {
  CreateImageUploadUrlDocument,
  ConfirmProfileImageUploadDocument,
  ConfirmItemImageUploadDocument,
  UpdateItemImageDocument,
} from '#operations/image/imageUpload.generated';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import {
  MAX_IMAGE_SIZE,
  MAX_PROFILE_SIZE,
  type ImageValidationError,
} from '#utils/imageValidation';
import { useStore } from '#store';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { logger } from '#/utils/environment';

// Minimal structural type for the translation function so this doesn't depend
// on i18next's generic `TFunction` namespace typing.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Turns an upload failure into copy a user can act on.
 *
 * `error.message` is never shown. Those strings are internal control-flow
 * signals — 'Failed to get upload URL', 'Upload request timed out', 'File too
 * large. Maximum size: 2MB' — written in English and never translated, so
 * surfacing them both leaks implementation detail and defeats localization.
 * `logger.error` already records the real one for debugging.
 *
 * `ImageValidationError.code` is the only reliable discriminator. Matching the
 * message instead (`message.includes('INVALID_TYPE')`) could never fire: the
 * code lives on `error.code` while the message reads 'Only JPEG, PNG, and WebP
 * images are allowed'. Only the 'file size' test ever matched, and it caught
 * UNKNOWN_ERROR ("couldn't determine the size") while claiming the image was
 * "too large or corrupted".
 */
const uploadErrorMessage = (
  t: Translate,
  error: unknown,
  isProfileImage: boolean,
): string => {
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
    case 'UNKNOWN_ERROR':
      return t('imageUpload.unreadableBody');
    default:
      return t('imageUpload.failedBody');
  }
};

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
}

export const useImageUpload = () => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Track active XHR to cancel on unmount (prevents memory leaks)
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  // Cleanup: abort any pending upload when component unmounts
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
  const [updateItemImage] = useMutation(UpdateItemImageDocument);

  /**
   * Uploads the bytes to object storage with the server's presigned POST.
   *
   * The policy in `uploadData.fields` must be appended before the file, and the
   * file part must be named `file` and come last — object storage enforces both
   * and answers 400 otherwise. The Content-Type header is deliberately not set:
   * the runtime has to author it so the multipart boundary matches the body.
   */
  const uploadToObjectStorage = async (
    file: ImageFile,
    uploadData: PresignedUploadData,
    onProgress?: (progress: number) => void,
  ): Promise<void> => {
    const mimeType = file.type || getMimeTypeFromUri(file.uri);

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
    const { onProgress, onSuccess, onError } = options;

    // Check if online before attempting upload
    const state = useStore.getState();
    if (!state.isOnline) {
      const offlineError = new Error(t('imageUpload.offlineError'));
      onError?.(offlineError);
      alertService.alert(
        t('imageUpload.offlineTitle'),
        t('imageUpload.offlineBody'),
      );
      return null;
    }

    setUploading(true);
    setProgress(0);

    const result = await executeMutation(
      async () => {
        // For profile images, handle missing file size gracefully
        let fileToUpload = { ...file };
        if (isProfileImage && !fileToUpload.fileSize) {
          logger.warn('File size missing, attempting to determine it...');
          logger.warn('Proceeding without file size - server will validate');
        }

        // Validate the image file
        validateImageFile(fileToUpload, isProfileImage);

        onProgress?.(10);

        // Step 1: Get presigned URL
        const mimeType =
          fileToUpload.type || getMimeTypeFromUri(fileToUpload.uri);
        const { data: uploadData } = await createUploadUrl({
          variables: {
            input: {
              mime: mimeType,
              purpose: purpose,
              itemId: itemId,
            },
          },
        });

        const uploadPayload = uploadData?.createImageUploadUrl;
        if (uploadPayload?.__typename !== 'CreateImageUploadUrlPayload') {
          throw new Error('Failed to get upload URL');
        }
        const uploadResult = uploadPayload;

        onProgress?.(30);

        // Step 2: Upload the bytes with the presigned POST
        await uploadToObjectStorage(
          fileToUpload,
          uploadResult,
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
      },
      error => {
        setUploading(false);
        setProgress(0);
        throw error;
      },
    );

    return result || null;
  };

  const uploadProfileImage = async (
    file: ImageFile,
    purpose: ImageUploadPurpose = ImageUploadPurpose.ProfileAvatar,
    options: ImageUploadOptions = {},
  ): Promise<string | null> => {
    const result = await executeMutation(
      () =>
        uploadImage(
          file,
          purpose,
          true,
          undefined,
          async (key: string) => {
            const { data } = await confirmProfileUpload({
              variables: { input: { key } },
            });
            return data?.confirmProfileImageUpload?.__typename ===
              'ConfirmProfileImageUploadPayload'
              ? data.confirmProfileImageUpload.url
              : null;
          },
          options,
        ),
      error => {
        logger.error('Profile image upload failed:', error);
        const userErrorMessage = uploadErrorMessage(t, error, true);
        options.onError?.(new Error(userErrorMessage));
        alertService.alert(t('imageUpload.failedTitle'), userErrorMessage);
      },
    );
    return result || null;
  };

  const uploadItemImage = async (
    file: ImageFile,
    itemId: string,
    options: ImageUploadOptions = {},
  ): Promise<string | null> => {
    const result = await executeMutation(
      () =>
        uploadImage(
          file,
          ImageUploadPurpose.ItemImage,
          false,
          itemId,
          async (key: string) => {
            const { data } = await confirmItemUpload({
              variables: { input: { itemId, key } },
            });
            return data?.confirmItemImageUpload?.__typename ===
              'ConfirmItemImageUploadPayload'
              ? data.confirmItemImageUpload.url
              : null;
          },
          options,
        ),
      error => {
        logger.error('Item image upload failed:', error);
        const errorMessage = uploadErrorMessage(t, error, false);
        options.onError?.(new Error(errorMessage));
        alertService.alert(t('imageUpload.failedTitle'), errorMessage);
      },
    );
    return result || null;
  };

  const uploadItemImages = async (
    files: Array<ImageFile & { perspective?: string }>,
    itemId: string,
    options: ImageUploadOptions = {},
  ): Promise<Array<{ imageUrl: string; perspective: string }>> => {
    const results: Array<{ imageUrl: string; perspective: string }> = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const index = i;
      const imageUrl = await uploadItemImage(file, itemId, {
        onProgress: p => options?.onProgress?.((index + p) / files.length),
      });
      if (imageUrl) {
        results.push({ imageUrl, perspective: file.perspective || 'front' });
      }
    }
    return results;
  };

  const updateProfileAvatarUrl = async (avatarUrl: string) => {
    const result = await executeMutation(
      () =>
        updateProfile({
          variables: { input: { avatar: avatarUrl } },
        }),
      error => {
        logger.error('Update profile avatar failed:', error);
        alertService.alert(
          t('imageUpload.updateFailedTitle'),
          t('imageUpload.avatarUpdateFailedBody'),
        );
      },
    );
    if (!result) return null;
    // Sync avatar to Zustand store so screens reading from the store
    // (e.g. Pantry header) reflect the change immediately.
    useStore.getState().updateUser({ profilePicture: avatarUrl });
    return result.data?.updateProfile?.__typename === 'UpdateProfilePayload'
      ? result.data.updateProfile.userProfile
      : null;
  };

  const updateProfileCoverUrl = async (coverImageUrl: string) => {
    const result = await executeMutation(
      () =>
        updateProfile({
          variables: { input: { coverImage: coverImageUrl } },
        }),
      error => {
        logger.error('Update profile cover failed:', error);
        alertService.alert(
          t('imageUpload.updateFailedTitle'),
          t('imageUpload.coverUpdateFailedBody'),
        );
      },
    );
    if (!result) return null;
    return result.data?.updateProfile?.__typename === 'UpdateProfilePayload'
      ? result.data.updateProfile.userProfile
      : null;
  };

  const updateItemImageUrl = async (id: string, imageUrl: string) => {
    const result = await executeMutation(
      () =>
        updateItemImage({
          variables: { id, imageUrl },
        }),
      error => {
        logger.error('Update item image failed:', error);
        alertService.alert(
          t('imageUpload.updateFailedTitle'),
          t('imageUpload.itemImageUpdateFailedBody'),
        );
      },
    );
    if (!result) return null;
    return result.data?.updateItem || null;
  };

  return {
    uploading,
    progress,
    uploadProfileImage,
    uploadItemImage,
    uploadItemImages,
    updateProfileAvatarUrl,
    updateProfileCoverUrl,
    updateItemImageUrl,
  };
};
