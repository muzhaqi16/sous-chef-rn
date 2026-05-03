import React, { useState } from 'react';
import { View, Image, ScrollView } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { getPerspectiveLabel } from '#utils/imageUtils';
import { ImagePicker, type ImageFile } from './ImagePicker';
import { ModalPicker } from './ModalPicker';
import { Text } from '#components/atoms/Text';

export interface SelectedImage extends ImageFile {
  perspective: string;
}

interface MultiImagePickerProps {
  images: SelectedImage[];
  onImagesChanged: (images: SelectedImage[]) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  maxImages?: number;
  label?: string;
}

const PERSPECTIVES = [
  'front',
  'back',
  'left',
  'right',
  'nutrition_label',
  'ingredient_list',
];

const PERSPECTIVE_OPTIONS = PERSPECTIVES.map(p => ({
  label: getPerspectiveLabel(p),
  value: p,
}));

const getNextAvailablePerspective = (
  existingImages: SelectedImage[],
): string => {
  const usedPerspectives = new Set(existingImages.map(img => img.perspective));
  for (const perspective of PERSPECTIVES) {
    if (!usedPerspectives.has(perspective)) {
      return perspective;
    }
  }
  return 'front';
};

export const MultiImagePicker: React.FC<MultiImagePickerProps> = ({
  images,
  onImagesChanged,
  onError,
  disabled = false,
  maxImages = 6,
  label = 'Product Images',
}) => {
  const { theme } = useUnistyles();

  const handleMultiImagesSelected = (newFiles: ImageFile[]) => {
    const remaining = maxImages - images.length;
    const filesToAdd = newFiles.slice(0, remaining);

    const newImages: SelectedImage[] = filesToAdd.map((file, index) => {
      // Build perspective set from existing + already-assigned new images
      const allSoFar = [
        ...images,
        ...filesToAdd.slice(0, index).map((f, i) => ({
          ...f,
          perspective: getNextAvailablePerspective([
            ...images,
            ...filesToAdd.slice(0, i).map(ff => ({ ...ff, perspective: '' })),
          ]),
        })),
      ];
      return {
        ...file,
        perspective: getNextAvailablePerspective(allSoFar),
      };
    });

    onImagesChanged([...images, ...newImages]);
  };

  const handleSingleImageSelected = (file: ImageFile) => {
    if (images.length >= maxImages) return;
    const newImage: SelectedImage = {
      ...file,
      perspective: getNextAvailablePerspective(images),
    };
    onImagesChanged([...images, newImage]);
  };

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    onImagesChanged(updated);
  };

  const handlePerspectiveChange = (index: number, perspective: string) => {
    const updated = images.map((img, i) =>
      i === index ? { ...img, perspective } : img,
    );
    onImagesChanged(updated);
  };

  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <View style={styles.container}>
        <Text size="base" weight="medium" style={styles.label}>
          {label}
        </Text>
        <ImagePicker
          onImageSelected={handleSingleImageSelected}
          onMultiImageSelected={handleMultiImagesSelected}
          multiSelect
          onError={onError}
          disabled={disabled}
          isProfile={false}
        >
          <View style={styles.placeholderContainer}>
            <Icon
              name="camera-outline"
              size={32}
              color={theme.colors.textSecondary}
            />
            <Text size="base" tone="secondary" align="center">
              Add Photos
            </Text>
            <Text size="sm" tone="secondary" align="center">
              Select up to {maxImages} images
            </Text>
          </View>
        </ImagePicker>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text size="base" weight="medium" style={styles.label}>
        {label} ({images.length}/{maxImages})
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {images.map((image, index) => (
          <View key={`${image.uri}-${index}`} style={styles.imageEntry}>
            <View style={styles.thumbnailWrapper}>
              <Image
                source={{ uri: image.uri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => handleRemoveImage(index)}
                disabled={disabled}
                hitSlop={11}
                accessibilityRole="button"
                accessibilityLabel="Remove image"
              >
                <Icon name="close" size={14} color={theme.colors.white} />
              </Pressable>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.perspectiveButton,
                pressed && styles.pressed,
              ]}
              onPress={() => setPickerIndex(index)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Change image perspective"
            >
              <Text
                size="xs"
                weight="medium"
                style={styles.perspectiveText}
                numberOfLines={1}
              >
                {getPerspectiveLabel(image.perspective)}
              </Text>
              <Icon
                name="chevron-down"
                size={14}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          </View>
        ))}

        {images.length < maxImages && (
          <ImagePicker
            onImageSelected={handleSingleImageSelected}
            onMultiImageSelected={handleMultiImagesSelected}
            multiSelect
            onError={onError}
            disabled={disabled}
            isProfile={false}
          >
            <View style={styles.addMoreButton}>
              <Icon
                name="camera-outline"
                size={24}
                color={theme.colors.primary}
              />
              <Text size="xs" weight="medium" tone="accent">
                Add More
              </Text>
            </View>
          </ImagePicker>
        )}
      </ScrollView>

      <ModalPicker
        label="Select Perspective"
        visible={pickerIndex !== null}
        options={PERSPECTIVE_OPTIONS}
        selected={
          pickerIndex !== null ? images[pickerIndex]?.perspective ?? '' : ''
        }
        onSelect={value => {
          if (pickerIndex !== null) {
            handlePerspectiveChange(pickerIndex, value);
          }
          setPickerIndex(null);
        }}
        onCancel={() => setPickerIndex(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginTop: theme.spacing.sm,
  },
  label: {
    marginBottom: theme.spacing.sm,
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
  scrollContent: {
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  imageEntry: {
    width: 120,
    alignItems: 'center',
  },
  thumbnailWrapper: {
    position: 'relative',
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.surfaceVariant,
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: theme.radii.full,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  perspectiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    maxWidth: 120,
  },
  perspectiveText: {
    flexShrink: 1,
  },
  addMoreButton: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
