import React, { useState } from 'react';
import { View, Image, ActivityIndicator } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { ImagePicker, ImageFile } from './ImagePicker';
import { useImageUpload } from '#hooks/useImageUpload';
import { commonStyles } from '#/styles/commonStyles';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { executeAsyncWithCleanup } from '#/utils/compilerSafeWrappers';
import { Text } from '#components/atoms/Text';

const WhiteActivityIndicator = withUnistyles(ActivityIndicator, theme => ({
  color: theme.colors.white,
}));

const PrimaryActivityIndicator = withUnistyles(ActivityIndicator, theme => ({
  color: theme.colors.primary,
}));

interface ImageUploadFieldProps {
  label?: string;
  value?: string; // Current image URL
  onImageUploaded?: (imageUrl: string) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  isProfile?: boolean;
  itemId?: string; // Required for item image uploads
  profilePurpose?: ImageUploadPurpose; // Required for profile uploads
  required?: boolean;
  placeholder?: string;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  value,
  onImageUploaded,
  onError,
  disabled = false,
  isProfile = false,
  itemId,
  profilePurpose,
  required = false,
  placeholder = 'No image selected',
}) => {
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { uploading, uploadProfileImage, uploadItemImage } = useImageUpload();

  styles.useVariants({ required, profile: isProfile });

  const handleImageSelected = (image: ImageFile) => {
    setSelectedImage(image);

    // Start upload immediately after selection
    executeAsyncWithCleanup(
      async () => {
        let imageUrl: string | null = null;

        if (isProfile && profilePurpose) {
          imageUrl = await uploadProfileImage(image, profilePurpose, {
            onProgress: setUploadProgress,
            onSuccess: onImageUploaded,
            onError,
          });
        } else if (itemId) {
          imageUrl = await uploadItemImage(image, itemId, {
            onProgress: setUploadProgress,
            onSuccess: onImageUploaded,
            onError,
          });
        } else {
          const error = new Error(
            'Either itemId or profilePurpose must be provided',
          );
          onError?.(error);
          return;
        }

        if (imageUrl) {
          onImageUploaded?.(imageUrl);
        }
      },
      () => setUploadProgress(0),
      error => {
        const uploadError =
          error instanceof Error ? error : new Error('Upload failed');
        onError?.(uploadError);
      },
    );
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setUploadProgress(0);
    onImageUploaded?.('');
  };

  const currentImageUri = selectedImage?.uri || value;
  const hasImage = Boolean(currentImageUri);

  return (
    <View style={commonStyles.inputGroup}>
      {!!label && (
        <Text style={[commonStyles.label, styles.requiredLabelOverlay]}>
          {label}
          {required ? ' *' : null}
        </Text>
      )}

      <View style={styles.container}>
        {hasImage ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: currentImageUri }}
              style={styles.imagePreview}
              resizeMode="cover"
            />

            {!!uploading && (
              <View style={styles.uploadOverlay}>
                <WhiteActivityIndicator size="large" />
                <Text size="sm" weight="medium" style={styles.progressText}>
                  {uploadProgress > 0
                    ? `${Math.round(uploadProgress)}%`
                    : 'Uploading...'}
                </Text>
              </View>
            )}

            {!uploading && (
              <View style={styles.imageActions}>
                <ImagePicker
                  onImageSelected={handleImageSelected}
                  onError={onError}
                  disabled={disabled || uploading}
                  isProfile={isProfile}
                >
                  <View style={styles.actionButton}>
                    <Icon name="create-outline" size={16} tone="white" />
                  </View>
                </ImagePicker>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleRemoveImage}
                  disabled={disabled || uploading}
                >
                  <Icon name="trash-outline" size={16} tone="white" />
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <ImagePicker
            onImageSelected={handleImageSelected}
            onError={onError}
            disabled={disabled || uploading}
            isProfile={isProfile}
          >
            <View style={styles.placeholderContainer}>
              <Icon name="camera-outline" size={32} tone="textSecondary" />
              <Text size="base" tone="secondary" align="center">
                {uploading ? 'Uploading...' : placeholder}
              </Text>
              {!!uploading && (
                <View style={styles.progressContainer}>
                  <PrimaryActivityIndicator size="small" />
                  <Text size="sm" weight="medium" style={styles.progressText}>
                    {uploadProgress > 0 ? `${Math.round(uploadProgress)}%` : ''}
                  </Text>
                </View>
              )}
            </View>
          </ImagePicker>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    minHeight: 120,
  },
  requiredLabelOverlay: {
    variants: {
      required: {
        true: { color: theme.colors.error },
      },
    },
  },
  imageContainer: {
    position: 'relative',
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.surfaceVariant,
    variants: {
      profile: {
        true: { height: 120 },
      },
    },
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  imageActions: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: theme.radii.full,
    padding: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    minHeight: 120,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  progressText: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
