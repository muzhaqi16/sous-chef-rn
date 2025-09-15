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

      // For MinIO presigned URLs, we need to upload the raw file directly
      const response = await fetch(file.uri);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadData.url, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': mimeType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
        );
      }
    },
    [],
  );

  const uploadProfileImage = useCallback(
    async (
      file: ImageFile,
      purpose: ImageUploadPurpose = ImageUploadPurpose.ProfileAvatar,
      options: ImageUploadOptions = {},
    ): Promise<string | null> => {
      const { onProgress, onSuccess, onError } = options;

      try {
        setUploading(true);
        setProgress(0);

        // Ensure we have file size - critical for validation
        let fileToUpload = { ...file };
        if (!fileToUpload.fileSize) {
          console.warn('File size missing, attempting to determine it...');
          try {
            const response = await fetch(file.uri);
            const blob = await response.blob();
            fileToUpload.fileSize = blob.size;
          } catch (fetchError) {
            throw new Error('Unable to determine file size for upload');
          }
        }

        // Validate the image file
        validateImageFile(fileToUpload, true);

        onProgress?.(10);

        // Step 1: Get presigned URL
        const mimeType =
          fileToUpload.type || getMimeTypeFromUri(fileToUpload.uri);
        const { data: uploadData } = await createUploadUrl({
          variables: {
            mime: mimeType,
            purpose: purpose,
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
        const { data: confirmData } = await confirmProfileUpload({
          variables: {
            key: uploadResult.key,
          },
        });

        const finalImageUrl = confirmData?.confirmProfileImageUpload;
        if (!finalImageUrl) {
          throw new Error('Failed to confirm upload');
        }

        onProgress?.(100);
        onSuccess?.(finalImageUrl);

        return finalImageUrl;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';

        // Provide more specific error messages based on the error
        let userErrorMessage = errorMessage;
        if (errorMessage.includes('file size')) {
          userErrorMessage =
            'The image file is too large or corrupted. Please try a different image.';
        } else if (errorMessage.includes('INVALID_TYPE')) {
          userErrorMessage = 'Please select a JPEG, PNG, or WebP image file.';
        } else if (errorMessage.includes('FILE_TOO_LARGE')) {
          userErrorMessage = `The image is too large. Profile images must be under ${MAX_PROFILE_SIZE / 1024 / 1024}MB.`;
        }

        onError?.(new Error(userErrorMessage));
        Alert.alert('Upload Failed', userErrorMessage);
        return null;
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [createUploadUrl, confirmProfileUpload, uploadToMinIO],
  );

  const uploadItemImage = useCallback(
    async (
      file: ImageFile,
      itemId: string,
      options: ImageUploadOptions = {},
    ): Promise<string | null> => {
      const { onProgress, onSuccess, onError } = options;

      try {
        setUploading(true);
        setProgress(0);

        // Validate the image file
        validateImageFile(file, false);

        onProgress?.(10);

        // Step 1: Get presigned URL
        const mimeType = file.type || getMimeTypeFromUri(file.uri);

        const { data: uploadData } = await createUploadUrl({
          variables: {
            mime: mimeType,
            purpose: ImageUploadPurpose.ItemImage,
            itemId: itemId,
          },
        });

        const uploadResult = uploadData?.createImageUploadUrl;
        if (!uploadResult) {
          throw new Error('Failed to get upload URL');
        }

        onProgress?.(30);

        // Step 2: Upload to MinIO
        await uploadToMinIO(file, uploadResult, uploadProgress => {
          onProgress?.(30 + uploadProgress * 0.5);
        });

        onProgress?.(80);

        // Step 3: Confirm upload
        const { data: confirmData } = await confirmItemUpload({
          variables: {
            itemId: itemId,
            key: uploadResult.key,
          },
        });

        const finalImageUrl = confirmData?.confirmItemImageUpload;
        if (!finalImageUrl) {
          throw new Error('Failed to confirm upload');
        }
        onProgress?.(100);
        onSuccess?.(finalImageUrl);

        return finalImageUrl;
      } catch (error) {
        console.error('Item image upload failed:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';
        onError?.(new Error(errorMessage));
        Alert.alert('Upload Failed', errorMessage);
        return null;
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [createUploadUrl, confirmItemUpload, uploadToMinIO],
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
