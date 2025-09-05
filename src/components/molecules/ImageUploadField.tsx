import React, {useState, useCallback} from 'react';
import {View, Text, Image, TouchableOpacity, ActivityIndicator} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import Icon from '@react-native-vector-icons/material-icons';
import {ImagePicker, ImageFile} from './ImagePicker';
import {useImageUpload} from '#hooks';
import {commonStyles} from '#styles';

interface ImageUploadFieldProps {
  label?: string;
  value?: string; // Current image URL
  onImageUploaded?: (imageUrl: string) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  isProfile?: boolean;
  itemId?: string; // Required for item image uploads
  profilePurpose?: 'PROFILE_AVATAR' | 'PROFILE_COVER'; // Required for profile uploads
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
  const {theme} = useUnistyles();
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const {
    uploading,
    uploadProfileImage,
    uploadItemImage,
  } = useImageUpload();

  const handleImageSelected = useCallback((image: ImageFile) => {
    setSelectedImage(image);
    
    // Start upload immediately after selection
    const startUpload = async () => {
      try {
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
          const error = new Error('Either itemId or profilePurpose must be provided');
          onError?.(error);
          return;
        }

        if (imageUrl) {
          onImageUploaded?.(imageUrl);
        }
      } catch (error) {
        const uploadError = error instanceof Error ? error : new Error('Upload failed');
        onError?.(uploadError);
      } finally {
        setUploadProgress(0);
      }
    };

    startUpload();
  }, [isProfile, profilePurpose, itemId, uploadProfileImage, uploadItemImage, onImageUploaded, onError]);

  const handleRemoveImage = useCallback(() => {
    setSelectedImage(null);
    setUploadProgress(0);
    onImageUploaded?.('');
  }, [onImageUploaded]);

  const currentImageUri = selectedImage?.uri || value;
  const hasImage = Boolean(currentImageUri);

  return (
    <View style={commonStyles.inputGroup}>
      {label && (
        <Text style={[commonStyles.label, required && styles.requiredLabel]}>
          {label}
          {required && ' *'}
        </Text>
      )}
      
      <View style={styles.container}>
        {hasImage ? (
          <View style={styles.imageContainer}>
            <Image 
              source={{uri: currentImageUri}} 
              style={[
                styles.imagePreview,
                isProfile && styles.profileImagePreview
              ]}
              resizeMode="cover"
            />
            
            {uploading && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="large" color={theme.colors.white} />
                <Text style={styles.progressText}>
                  {uploadProgress > 0 ? `${Math.round(uploadProgress)}%` : 'Uploading...'}
                </Text>
              </View>
            )}
            
            {!uploading && (
              <View style={styles.imageActions}>
                <ImagePicker
                  onImageSelected={handleImageSelected}
                  onError={onError}
                  disabled={disabled || uploading}
                  isProfile={isProfile}>
                  <View style={styles.actionButton}>
                    <Icon name="edit" size={16} color={theme.colors.white} />
                  </View>
                </ImagePicker>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleRemoveImage}
                  disabled={disabled || uploading}>
                  <Icon name="delete" size={16} color={theme.colors.white} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <ImagePicker
            onImageSelected={handleImageSelected}
            onError={onError}
            disabled={disabled || uploading}
            isProfile={isProfile}>
            <View style={styles.placeholderContainer}>
              <Icon name="add-a-photo" size={32} color={theme.colors.textSecondary} />
              <Text style={styles.placeholderText}>
                {uploading ? 'Uploading...' : placeholder}
              </Text>
              {uploading && (
                <View style={styles.progressContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.progressText}>
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
  requiredLabel: {
    color: theme.colors.error,
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
  },
  profileImagePreview: {
    height: 120,
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
  placeholderText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  progressText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.medium,
  },
}));