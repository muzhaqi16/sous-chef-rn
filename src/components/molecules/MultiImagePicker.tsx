import React, { useState } from 'react';
import { View, Image } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { getPerspectiveLabel, CAPTURE_PERSPECTIVES } from '#utils/imageUtils';
import { ImagePicker, type ImageFile } from './ImagePicker';
import { ModalPicker } from './ModalPicker';
import { Text } from '#components/atoms/Text';

export interface SelectedImage extends ImageFile {
  perspective: string;
  /**
   * Marks the photo to become the item's hero once uploaded. Only ever set
   * when the host passes `allowPrimarySelection`; exactly one image in the list
   * carries it.
   */
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
   * Offer a "main photo" star per thumbnail.
   *
   * Only pass this where the server will honour the choice: the photos have to
   * land APPROVED and the user has to be able to edit the item. On the
   * suggestion path they land PENDING and `makePrimary` is ignored, so the star
   * would promise something review might never grant.
   */
  allowPrimarySelection?: boolean;
}

/**
 * Guarantees exactly one primary once the affordance is live, so the star is
 * never shown with nothing selected. Index 0 is the seed because it is the
 * photo the user picked first — the same one the server would land on for a
 * fresh item, which makes turning the feature on a no-op until they choose.
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
  // Resolved here rather than as a default parameter: the fallback is
  // translated, and a default parameter would have to be an English literal.
  const resolvedLabel = label ?? t('imagePicker.productImages');
  const perspectiveOptions = CAPTURE_PERSPECTIVES.map(p => ({
    label: getPerspectiveLabel(p, t),
    value: p,
  }));

  const handleMultiImagesSelected = (newFiles: ImageFile[]) => {
    const remaining = maxImages - images.length;
    const filesToAdd = newFiles.slice(0, remaining);

    // Assign in one forward pass, feeding each result back in. The previous
    // version rebuilt the "already taken" set per file and blanked the
    // perspectives inside it, so every file after the first saw a used-set of
    // {''} and got 'front' — four photos came out front/back/back/back. Those
    // labels now reach confirmItemImageUpload, so a collision is persisted
    // catalog data, not just a mislabeled row.
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
    // Dropping the primary leaves the list with none, so re-seed it rather than
    // uploading a batch that silently keeps the item's existing hero.
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
        <Text size="base" weight="medium" style={styles.label}>
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
            <Text size="base" tone="secondary" align="center">
              {t('imagePicker.addPhotos')}
            </Text>
            <Text size="sm" tone="secondary" align="center">
              {t('imagePicker.selectUpTo', { max: maxImages })}
            </Text>
          </View>
        </ImagePicker>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text size="base" weight="medium" style={styles.label}>
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
              <Image
                source={{ uri: image.uri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
              <AppPressable
                style={styles.removeButton}
                onPress={() => handleRemoveImage(index)}
                disabled={disabled}
                hitSlop={11}
                accessibilityRole="button"
                accessibilityLabel={t('imagePicker.removeImage')}
              >
                <Icon name="close" size={14} tone="white" />
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
                    tone={image.isPrimary ? 'rating' : 'white'}
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
                size="xs"
                weight="medium"
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
              <Text size="xs" weight="medium" tone="accent">
                {t('imagePicker.addMore')}
              </Text>
            </View>
          </ImagePicker>
        )}
      </ScrollView>
      <ModalPicker
        label={t('imagePicker.selectPerspective')}
        visible={pickerIndex !== null}
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
    borderWidth: 2,
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
  // Opposite corner from remove: the two are 22pt targets on an 80pt thumbnail,
  // and adjacent ones would be a coin-flip under a fingertip.
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
    borderWidth: 2,
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
