import React, { useState } from 'react';
import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { getPerspectiveLabel, CAPTURE_PERSPECTIVES } from '#utils/imageUtils';
import { ImagePicker } from '#features/catalog/components/ImagePicker';
import type { ImageFile } from '#/types/media';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { Text } from '#components/atoms/Text';
import { LocalImage } from '#components/atoms/LocalImage';

export interface SelectedImage extends ImageFile {
  perspective: string;
  /** The hero once uploaded. Set only under `allowPrimarySelection`, on exactly one image. */
  isPrimary?: boolean;
}

interface MultiImagePickerProps {
  images: SelectedImage[];
  onImagesChanged: (images: SelectedImage[]) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  maxImages?: number;
  label?: string;
  /**
   * Offer a "main photo" star. Only where the server will honour it — on the
   * suggestion path photos land PENDING and `makePrimary` is ignored, so the star
   * would promise something review might never grant.
   */
  allowPrimarySelection?: boolean;
}

/**
 * Guarantees exactly one primary once the affordance is live, so the star is never
 * shown with nothing selected. Index 0 seeds it, matching what the server would
 * pick for a fresh item.
 */
const withPrimary = (
  list: SelectedImage[],
  enabled: boolean,
): SelectedImage[] => {
  if (!enabled || list.length === 0) return list;
  if (list.some(image => image.isPrimary)) return list;
  return list.map((image, i) =>
    i === 0 ? { ...image, isPrimary: true } : image,
  );
};

const getNextAvailablePerspective = (
  existingImages: SelectedImage[],
): string => {
  const usedPerspectives = new Set(existingImages.map(img => img.perspective));
  for (const perspective of CAPTURE_PERSPECTIVES) {
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
  label,
  allowPrimarySelection = false,
}) => {
  const { t } = useTranslation();
  // Not a default parameter: the fallback is translated, and a default would have
  // to be an English literal.
  const resolvedLabel = label ?? t('imagePicker.productImages');
  const perspectiveOptions = CAPTURE_PERSPECTIVES.map(p => ({
    label: getPerspectiveLabel(p, t),
    value: p,
  }));

  const handleMultiImagesSelected = (newFiles: ImageFile[]) => {
    const remaining = maxImages - images.length;
    const filesToAdd = newFiles.slice(0, remaining);

    // One forward pass, feeding each result back in, so the "already taken" set
    // stays accurate across files — these labels reach confirmItemImageUpload, so
    // a collision is persisted catalog data, not just a mislabeled row.
    const assigned: SelectedImage[] = [];
    for (const file of filesToAdd) {
      assigned.push({
        ...file,
        perspective: getNextAvailablePerspective([...images, ...assigned]),
      });
    }

    onImagesChanged(
      withPrimary([...images, ...assigned], allowPrimarySelection),
    );
  };

  const handleSingleImageSelected = (file: ImageFile) => {
    if (images.length >= maxImages) return;
    const newImage: SelectedImage = {
      ...file,
      perspective: getNextAvailablePerspective(images),
    };
    onImagesChanged(withPrimary([...images, newImage], allowPrimarySelection));
  };

  const handleRemoveImage = (index: number) => {
    // Re-seed, or the batch silently keeps the item's existing hero.
    const updated = images.filter((_, i) => i !== index);
    onImagesChanged(withPrimary(updated, allowPrimarySelection));
  };

  const handlePerspectiveChange = (index: number, perspective: string) => {
    const updated = images.map((img, i) =>
      i === index ? { ...img, perspective } : img,
    );
    onImagesChanged(updated);
  };

  const handleSetPrimary = (index: number) => {
    onImagesChanged(
      images.map((img, i) => ({ ...img, isPrimary: i === index })),
    );
  };

  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <View style={styles.container}>
        <Text role="bodyStrong" style={styles.label}>
          {resolvedLabel}
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
            <Icon name="camera-outline" size={32} tone="textSecondary" />
            <Text tone="secondary" align="center">
              {t('imagePicker.addPhotos')}
            </Text>
            <Text role="caption" tone="secondary" align="center">
              {t('imagePicker.selectUpTo', { max: maxImages })}
            </Text>
          </View>
        </ImagePicker>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text role="bodyStrong" style={styles.label}>
        {resolvedLabel} ({images.length}/{maxImages})
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {images.map((image, index) => (
          <View key={`${image.uri}-${index}`} style={styles.imageEntry}>
            <View style={styles.thumbnailWrapper}>
              <LocalImage uri={image.uri} style={styles.thumbnail} />
              <AppPressable
                style={styles.removeButton}
                onPress={() => handleRemoveImage(index)}
                disabled={disabled}
                hitSlop={11}
                accessibilityRole="button"
                accessibilityLabel={t('imagePicker.removeImage')}
              >
                <Icon name="close" size={14} tone="onScrim" />
              </AppPressable>
              {!!allowPrimarySelection && (
                <AppPressable
                  style={styles.primaryButton}
                  onPress={() => handleSetPrimary(index)}
                  disabled={disabled || image.isPrimary}
                  hitSlop={11}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !!image.isPrimary }}
                  accessibilityLabel={t(
                    image.isPrimary
                      ? 'itemPhotos.mainPhoto'
                      : 'itemPhotos.setAsMain',
                  )}
                >
                  <Icon
                    name={image.isPrimary ? 'star' : 'star-outline'}
                    size={14}
                    tone={image.isPrimary ? 'rating' : 'onScrim'}
                  />
                </AppPressable>
              )}
            </View>
            <AppPressable
              style={styles.perspectiveButton}
              onPress={() => setPickerIndex(index)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={t('imagePicker.changePerspective')}
            >
              <Text
                role="label"
                style={styles.perspectiveText}
                numberOfLines={1}
              >
                {getPerspectiveLabel(image.perspective, t)}
              </Text>
              <Icon name="chevron-down" size={14} tone="textSecondary" />
            </AppPressable>
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
              <Icon name="camera-outline" size={24} tone="primary" />
              <Text role="label" tone="accent">
                {t('imagePicker.addMore')}
              </Text>
            </View>
          </ImagePicker>
        )}
      </ScrollView>
      {/* `push` because this picker only ever opens from inside a sheet;
          gorhom's default `'switch'` minimizes the host, which reads as the
          form vanishing. */}
      <ModalPicker
        label={t('imagePicker.selectPerspective')}
        visible={pickerIndex !== null}
        stackBehavior="push"
        options={perspectiveOptions}
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
    borderWidth: theme.borderWidth.medium,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
  // Opposite corner from remove: two 22pt targets on an 80pt thumbnail.
  primaryButton: {
    position: 'absolute',
    bottom: 2,
    left: 2,
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
    borderWidth: theme.borderWidth.medium,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
