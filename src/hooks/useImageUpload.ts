import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { validateImageFile, getMimeTypeFromUri } from '#utils/imageValidation';
import {
  useCreateImageUploadUrlMutation,
  useConfirmProfileImageUploadMutation,
  useConfirmItemImageUploadMutation,
  useUpdateProfileAvatarMutation,
  useUpdateProfileCoverMutation,
  useUpdateItemImageMutation,
  ImageUploadPurpose,
} from '#generated';
import { MAX_PROFILE_SIZE } from '#utils/imageValidation';
import { useStore } from '#store';

export interface ImageFile {
  uri: string;
  fileName?: string;
  fileSize?: number;
  type?: string;
}

export interface PresignedUploadData {
  url: string;
  key: string;
}

export interface ImageUploadOptions {
  onProgress?: (progress: number) => void;
  onSuccess?: (imageUrl: string) => void;
  onError?: (error: Error) => void;
}

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [createUploadUrl] = useCreateImageUploadUrlMutation();
  const [confirmProfileUpload] = useConfirmProfileImageUploadMutation();
  const [confirmItemUpload] = useConfirmItemImageUploadMutation();
  const [updateProfileAvatar] = useUpdateProfileAvatarMutation();
  const [updateProfileCover] = useUpdateProfileCoverMutation();
  const [updateItemImage] = useUpdateItemImageMutation();

  const uploadToMinIO = useCallback(
    async (
      file: ImageFile,
      uploadData: PresignedUploadData,
      onProgress?: (progress: number) => void,
    ): Promise<void> => {
      const mimeType = file.type || getMimeTypeFromUri(file.uri);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `Upload failed: ${xhr.status} ${xhr.statusText}`,
              ),
            );
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network request failed during upload'));
        };

        xhr.ontimeout = () => {
          reject(new Error('Upload request timed out'));
        };

        if (onProgress && xhr.upload) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const uploadProgress = event.loaded / event.total;
              onProgress(uploadProgress);
            }
          };
        }

        xhr.open('PUT', uploadData.url);
        xhr.setRequestHeader('Content-Type', mimeType);
        xhr.timeout = 60000; // 60 second timeout

        // XMLHttpRequest in React Native can handle file:// URIs properly
        // by passing an object with uri, type, and name
        xhr.send({
          uri: file.uri,
          type: mimeType,
          name: file.fileName || 'image.jpg',
        });
      });
    },
    [],
  );

  const uploadImage = useCallback(
    async (
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
        const offlineError = new Error(
          "You're offline. Image upload requires an internet connection."
        );
        onError?.(offlineError);
        Alert.alert(
          'No Internet Connection',
          "Image upload requires an internet connection. Please try again when you're online."
        );
        return null;
      }

      try {
        setUploading(true);
        setProgress(0);

        // For profile images, handle missing file size gracefully
        let fileToUpload = { ...file };
        if (isProfileImage && !fileToUpload.fileSize) {
          console.warn('File size missing, attempting to determine it...');
          console.warn('Proceeding without file size - server will validate');
        }

        // Validate the image file
        validateImageFile(fileToUpload, isProfileImage);

        onProgress?.(10);

        // Step 1: Get presigned URL
        const mimeType =
          fileToUpload.type || getMimeTypeFromUri(fileToUpload.uri);
        const { data: uploadData } = await createUploadUrl({
          variables: {
            mime: mimeType,
            purpose: purpose,
            itemId: itemId,
          },
        });

        const uploadResult = uploadData?.createImageUploadUrl;
        if (!uploadResult) {
          throw new Error('Failed to get upload URL');
        }

        onProgress?.(30);

        // Step 2: Upload to MinIO
        await uploadToMinIO(fileToUpload, uploadResult, uploadProgress => {
          onProgress?.(30 + uploadProgress * 0.5);
        });

        onProgress?.(80);

        // Step 3: Confirm upload
        const finalImageUrl = await confirmUploadFn(uploadResult.key);
        if (!finalImageUrl) {
          throw new Error('Failed to confirm upload');
        }

        onProgress?.(100);
        onSuccess?.(finalImageUrl);

        return finalImageUrl;
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [createUploadUrl, uploadToMinIO],
  );

  const uploadProfileImage = useCallback(
    async (
      file: ImageFile,
      purpose: ImageUploadPurpose = ImageUploadPurpose.ProfileAvatar,
      options: ImageUploadOptions = {},
    ): Promise<string | null> => {
      try {
        return await uploadImage(
          file,
          purpose,
          true,
          undefined,
          async (key: string) => {
            const { data } = await confirmProfileUpload({
              variables: { key },
            });
            return data?.confirmProfileImageUpload || null;
          },
          options,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';

        // Provide more specific error messages for profile images
        let userErrorMessage = errorMessage;
        if (errorMessage.includes('file size')) {
          userErrorMessage =
            'The image file is too large or corrupted. Please try a different image.';
        } else if (errorMessage.includes('INVALID_TYPE')) {
          userErrorMessage = 'Please select a JPEG, PNG, or WebP image file.';
        } else if (errorMessage.includes('FILE_TOO_LARGE')) {
          userErrorMessage = `The image is too large. Profile images must be under ${MAX_PROFILE_SIZE / 1024 / 1024}MB.`;
        }

        options.onError?.(new Error(userErrorMessage));
        Alert.alert('Upload Failed', userErrorMessage);
        return null;
      }
    },
    [uploadImage, confirmProfileUpload],
  );

  const uploadItemImage = useCallback(
    async (
      file: ImageFile,
      itemId: string,
      options: ImageUploadOptions = {},
    ): Promise<string | null> => {
      try {
        return await uploadImage(
          file,
          ImageUploadPurpose.ItemImage,
          false,
          itemId,
          async (key: string) => {
            const { data } = await confirmItemUpload({
              variables: { itemId, key },
            });
            return data?.confirmItemImageUpload || null;
          },
          options,
        );
      } catch (error) {
        console.error('Item image upload failed:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';
        options.onError?.(new Error(errorMessage));
        Alert.alert('Upload Failed', errorMessage);
        return null;
      }
    },
    [uploadImage, confirmItemUpload],
  );

  const updateProfileAvatarUrl = useCallback(
    async (avatarUrl: string) => {
      try {
        const { data } = await updateProfileAvatar({
          variables: { avatarUrl },
        });
        const result = data?.updateProfileAvatar;
        return result || null;
      } catch (error) {
        console.error('Update profile avatar failed:', error);
        Alert.alert('Update Failed', 'Failed to update profile avatar');
        return null;
      }
    },
    [updateProfileAvatar],
  );

  const updateProfileCoverUrl = useCallback(
    async (coverImageUrl: string) => {
      try {
        const { data } = await updateProfileCover({
          variables: { coverImageUrl },
        });
        const result = data?.updateProfileCover;
        return result || null;
      } catch (error) {
        console.error('Update profile cover failed:', error);
        Alert.alert('Update Failed', 'Failed to update profile cover');
        return null;
      }
    },
    [updateProfileCover],
  );

  const updateItemImageUrl = useCallback(
    async (itemId: string, imageUrl: string) => {
      try {
        const { data } = await updateItemImage({
          variables: {
            id: itemId,
            imageUrl,
          },
        });
        const result = data?.updateItemImage;
        return result || null;
      } catch (error) {
        console.error('Update item image failed:', error);
        Alert.alert('Update Failed', 'Failed to update item image');
        return null;
      }
    },
    [updateItemImage],
  );

  return {
    uploading,
    progress,
    uploadProfileImage,
    uploadItemImage,
    updateProfileAvatarUrl,
    updateProfileCoverUrl,
    updateItemImageUrl,
  };
};
