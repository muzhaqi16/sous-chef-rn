import React from 'react';
import {View, Text, TouchableOpacity, Image} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import Icon from '@react-native-vector-icons/material-icons';
import {ImagePicker, ImageFile} from './ImagePicker';

interface ProductImagePickerProps {
  selectedImage: ImageFile | null;
  onImageSelected: (image: ImageFile) => void;
  onImageRemoved: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  label?: string;
}

export const ProductImagePicker: React.FC<ProductImagePickerProps> = ({
  selectedImage,
  onImageSelected,
  onImageRemoved,
  onError,
  disabled = false,
  label = 'Product Image',
}) => {
  const {theme} = useUnistyles();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.imageContainer}>
        {selectedImage ? (
          <View style={styles.imagePreview}>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={onImageRemoved}
              disabled={disabled}>
              <Icon name="close" size={16} color={theme.colors.white} />
            </TouchableOpacity>
            <Image
              source={{uri: selectedImage.uri}}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        ) : (
          <ImagePicker
            onImageSelected={onImageSelected}
            onError={onError}
            disabled={disabled}
            isProfile={false}>
            <View style={styles.placeholderContainer}>
              <Icon name="add-a-photo" size={32} color={theme.colors.textSecondary} />
              <Text style={styles.placeholderText}>
                Take or select a photo
              </Text>
            </View>
          </ImagePicker>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginTop: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  imageContainer: {
    marginTop: theme.spacing.sm,
  },
  imagePreview: {
    position: 'relative',
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  removeButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: theme.radii.full,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.surfaceVariant,
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
}));