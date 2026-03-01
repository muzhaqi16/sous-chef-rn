import { useState, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { validateImageFile, getMimeTypeFromUri } from '#utils/imageValidation';
import {
  useCreateImageUploadUrlMutation,
  useConfirmProfileImageUploadMutation,
  useConfirmItemImageUploadMutation,
  useUpdateUserProfileMutation,
  useUpdateItemImageMutation,
  ImageUploadPurpose } from '#generated';
import { MAX_PROFILE_SIZE } from '#utils/imageValidation';
import { useStore } from '#store';
import { executeMutationWithErrorHandler } from '#/utils/compilerSafeWrappers';

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

  const [createUploadUrl] = useCreateImageUploadUrlMutation();
  const [confirmProfileUpload] = useConfirmProfileImageUploadMutation();
  const [confirmItemUpload] = useConfirmItemImageUploadMutation();
  const [updateProfile] = useUpdateUserProfileMutation();
  const [updateItemImage] = useUpdateItemImageMutation();

  const uploadToMinIO = async (
      file: ImageFile,
      uploadData: PresignedUploadData,
      onProgress?: (progress: number) => void,
    ): Promise<void> => {
      const mimeType = file.type || getMimeTypeFromUri(file.uri);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Store reference for cleanup on unmount
        activeXhrRef.current = xhr;

        xhr.onload = () => {
          activeXhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            console.error(
              `MinIO upload failed: status=${xhr.status}, url=${uploadData.url}, response=${xhr.responseText}`,
            );
            const statusText = xhr.statusText ? ` ${xhr.statusText}` : '';
            reject(
              new Error(
                `Upload failed: ${xhr.status}${statusText}`,
              ),
            );
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
          name: file.fileName || 'image.jpg' });
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

      setUploading(true);
      setProgress(0);

      const result = await executeMutationWithErrorHandler(
        async () => {
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
              itemId: itemId } });

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

          setUploading(false);
          setProgress(0);
          return finalImageUrl;
        },
        (error) => {
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
      const result = await executeMutationWithErrorHandler(
        () => uploadImage(
          file,
          purpose,
          true,
          undefined,
          async (key: string) => {
            const { data } = await confirmProfileUpload({
              variables: { key } });
            return data?.confirmProfileImageUpload?.url || null;
          },
          options,
        ),
        (error) => {
          console.error('Profile image upload failed:', error);
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
        },
      );
      return result || null;
    };

  const uploadItemImage = async (
      file: ImageFile,
      itemId: string,
      options: ImageUploadOptions = {},
    ): Promise<string | null> => {
      const result = await executeMutationWithErrorHandler(
        () => uploadImage(
          file,
          ImageUploadPurpose.ItemImage,
          false,
          itemId,
          async (key: string) => {
            const { data } = await confirmItemUpload({
              variables: { itemId, key } });
            return data?.confirmItemImageUpload?.url || null;
          },
          options,
        ),
        (error) => {
          console.error('Item image upload failed:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Upload failed';
          options.onError?.(new Error(errorMessage));
          Alert.alert('Upload Failed', errorMessage);
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
          onProgress: (p) => options?.onProgress?.(((index + p) / files.length)) });
        if (imageUrl) {
          results.push({ imageUrl, perspective: file.perspective || 'front' });
        }
      }
      return results;
    };

  const updateProfileAvatarUrl = async (avatarUrl: string) => {
      const result = await executeMutationWithErrorHandler(
        () => updateProfile({
          variables: { input: { avatar: avatarUrl } } }),
        (error) => {
          console.error('Update profile avatar failed:', error);
          Alert.alert('Update Failed', 'Failed to update profile avatar');
        },
      );
      if (!result) return null;
      return result.data?.updateProfile?.userProfile || null;
    };

  const updateProfileCoverUrl = async (coverImageUrl: string) => {
      const result = await executeMutationWithErrorHandler(
        () => updateProfile({
          variables: { input: { coverImage: coverImageUrl } } }),
        (error) => {
          console.error('Update profile cover failed:', error);
          Alert.alert('Update Failed', 'Failed to update profile cover');
        },
      );
      if (!result) return null;
      return result.data?.updateProfile?.userProfile || null;
    };

  const updateItemImageUrl = async (id: string, imageUrl: string) => {
      const result = await executeMutationWithErrorHandler(
        () => updateItemImage({
          variables: { id, imageUrl } }),
        (error) => {
          console.error('Update item image failed:', error);
          Alert.alert('Update Failed', 'Failed to update item image');
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
    updateItemImageUrl };
};
