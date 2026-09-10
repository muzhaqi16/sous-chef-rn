import React, { useState } from 'react';
import { logger } from '#/utils/environment';
import { useTranslation } from '#/i18n';
import { View, Image, Dimensions } from 'react-native';
import { alertService } from '#/services/alertService';
import {
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  GestureDetector,
} from 'react-native-gesture-handler';
import { AppPressable } from '#components/atoms/AppPressable';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  clamp,
} from 'react-native-reanimated';
import type { StaticScreenProps } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Icon } from '#utils/iconUtils';
import { StyleSheet } from 'react-native-unistyles';
import { MAX_PROFILE_SIZE } from '#utils/imageValidation';
import ImageEditor from '@react-native-community/image-editor';
import type { ImageFile } from '#/types/media';
import { errorService } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { Text } from '#components/atoms/Text';
import { useStore } from '#store';
import { LocalImage } from '#components/atoms/LocalImage';
import { Screen } from '#components/templates/Screen';

const { width: screenWidth } = Dimensions.get('window');
const CROP_SIZE = Math.min(screenWidth * 0.8, 300);

export const ImageCropScreen: React.FC<
  StaticScreenProps<{ imageFile: ImageFile }>
> = ({ route }) => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const { imageFile } = route.params;

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  const [isCropping, setIsCropping] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Shared values for animations
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const offset = useSharedValue({ x: 0, y: 0 });
  const startOffset = useSharedValue({ x: 0, y: 0 });

  // Get image dimensions when loaded
  const handleImageLoad = () => {
    setImageLoaded(true);

    Image.getSize(imageFile.uri, (width, height) => {
      if (__DEV__) {
        logger.debug('[ImageCrop] Image.getSize raw:', {
          width,
          height,
          uri: imageFile.uri,
        });
      }
      setOriginalSize({ width, height });
      const aspectRatio = width / height;

      // Make sure the image fills the crop area
      let displayWidth, displayHeight;

      if (aspectRatio >= 1) {
        // Image is wider or square - fit to crop size
        displayHeight = CROP_SIZE * 1.2; // Slightly larger than crop area
        displayWidth = displayHeight * aspectRatio;
      } else {
        // Image is taller - fit to crop size
        displayWidth = CROP_SIZE * 1.2; // Slightly larger than crop area
        displayHeight = displayWidth / aspectRatio;
      }

      if (__DEV__) {
        logger.debug('[ImageCrop] Computed display size:', {
          displayWidth,
          displayHeight,
          aspectRatio,
        });
      }
      setImageSize({ width: displayWidth, height: displayHeight });

      // Reset transforms
      scale.set(1);
      startScale.set(1);
      offset.set({ x: 0, y: 0 });
      startOffset.set({ x: 0, y: 0 });
    });
  };

  // Create pinch gesture
  const pinch = usePinchGesture({
    onActivate: () => {
      'worklet';
      startScale.set(scale.get());
    },
    onUpdate: e => {
      'worklet';
      scale.set(clamp(startScale.get() * e.scale, 0.5, 3));
    },
  });

  // Create pan gesture
  const pan = usePanGesture({
    averageTouches: true,
    onActivate: () => {
      'worklet';
      const currentOffset = offset.get();
      startOffset.set({ x: currentOffset.x, y: currentOffset.y });
    },
    onUpdate: e => {
      'worklet';
      // Calculate bounds based on current scale and image size
      const scaledWidth = (imageSize.width || CROP_SIZE) * scale.get();
      const scaledHeight = (imageSize.height || CROP_SIZE) * scale.get();

      const maxX = Math.max(0, (scaledWidth - CROP_SIZE) / 2);
      const maxY = Math.max(0, (scaledHeight - CROP_SIZE) / 2);

      const currentStartOffset = startOffset.get();
      const newX = clamp(currentStartOffset.x + e.translationX, -maxX, maxX);
      const newY = clamp(currentStartOffset.y + e.translationY, -maxY, maxY);

      offset.set({ x: newX, y: newY });
    },
  });

  // Compose gestures
  const composed = useSimultaneousGestures(pan, pinch);

  // Animated style
  const animatedStyle = useAnimatedStyle(() => {
    const currentOffset = offset.get();
    return {
      transform: [
        { translateX: currentOffset.x },
        { translateY: currentOffset.y },
        { scale: scale.get() },
      ],
    };
  });

  const handleCrop = () => {
    if (
      !imageSize.width ||
      !imageSize.height ||
      !originalSize.width ||
      !originalSize.height
    ) {
      alertService.alert(t('labels.error'), t('profile.imageNotLoaded'));
      return;
    }

    if (__DEV__) {
      logger.debug('[ImageCrop] handleCrop called:', {
        imageFileUri: imageFile.uri,
        imageFileType: imageFile.type,
        imageFileSize: imageFile.fileSize,
        imageSize,
        scale: scale.get(),
        offset: offset.get(),
      });
    }

    executeWithLoadingState(
      async () => {
        // Use dimensions captured during handleImageLoad — avoids a redundant
        // Image.getSize() call that can fail on Android when the content:// URI
        // loses temporary read permissions between load and crop.
        const originalImageSize = originalSize;

        if (__DEV__) {
          logger.debug('[ImageCrop] Original image size:', originalImageSize);
        }

        // Calculate the center position of the crop area relative to the image
        const cropCenterX = CROP_SIZE / 2;
        const cropCenterY = CROP_SIZE / 2;

        // Calculate where the image center is positioned on screen after transforms
        const currentOffset = offset.get();
        const imageCenterX = CROP_SIZE / 2 + currentOffset.x;
        const imageCenterY = CROP_SIZE / 2 + currentOffset.y;

        // Calculate the offset from image center to crop center
        const offsetFromImageCenter = {
          x: cropCenterX - imageCenterX,
          y: cropCenterY - imageCenterY,
        };

        // Convert display coordinates to original image coordinates
        const scaleRatio = originalImageSize.width / imageSize.width;

        // Calculate crop position in original image coordinates
        const cropX = Math.max(
          0,
          originalImageSize.width / 2 +
            (offsetFromImageCenter.x * scaleRatio) / scale.get(),
        );
        const cropY = Math.max(
          0,
          originalImageSize.height / 2 +
            (offsetFromImageCenter.y * scaleRatio) / scale.get(),
        );

        // Calculate crop size in original image coordinates
        const cropSizeInOriginal = (CROP_SIZE * scaleRatio) / scale.get();

        // On Android, Image.getSize() may return EXIF-rotated dimensions
        // (e.g. 1120x2000 for portrait) while ImageEditor.cropImage() operates
        // on the raw bitmap (e.g. 2000x1120). Clamp the crop square to the
        // smallest dimension so it fits regardless of bitmap orientation.
        const minDimension = Math.min(
          originalImageSize.width,
          originalImageSize.height,
        );
        const safeCropSizeInOriginal = Math.min(
          cropSizeInOriginal,
          minDimension,
        );

        // Ensure crop doesn't go outside image boundaries
        const finalCropX = Math.max(
          0,
          Math.floor(
            Math.min(
              cropX - safeCropSizeInOriginal / 2,
              minDimension - safeCropSizeInOriginal,
            ),
          ),
        );
        const finalCropY = Math.max(
          0,
          Math.floor(
            Math.min(
              cropY - safeCropSizeInOriginal / 2,
              minDimension - safeCropSizeInOriginal,
            ),
          ),
        );
        const finalCropSize = Math.max(
          1,
          Math.floor(
            Math.min(
              safeCropSizeInOriginal,
              minDimension - finalCropX,
              minDimension - finalCropY,
            ),
          ) - 1, // Safety margin: prevent off-by-one from BitmapRegionDecoder inSampleSize rounding
        );

        const cropOffset = { x: finalCropX, y: finalCropY };
        const cropSize = { width: finalCropSize, height: finalCropSize };
        const displaySize = { width: CROP_SIZE, height: CROP_SIZE };

        if (__DEV__) {
          logger.debug('[ImageCrop] Crop params:', {
            uri: imageFile.uri,
            cropOffset,
            cropSize,
            displaySize,
            scaleRatio,
            minDimension,
            originalImageSize,
          });
        }

        const { uri: croppedUri } = await ImageEditor.cropImage(imageFile.uri, {
          offset: cropOffset,
          size: cropSize,
          displaySize,
          resizeMode: 'contain',
        });

        // Estimate file size for logging purposes only
        // Note: Cropping always reduces size, so no validation needed here.
        // Original image was already validated before cropping.
        const cropRatio =
          (finalCropSize * finalCropSize) /
          (originalImageSize.width * originalImageSize.height);
        const estimatedFileSize = imageFile.fileSize
          ? Math.floor(imageFile.fileSize * cropRatio * 0.8)
          : MAX_PROFILE_SIZE / 2; // Conservative estimate if original size unknown

        const croppedImage: ImageFile = {
          uri: croppedUri,
          fileName: `cropped_${imageFile.fileName || 'profile.jpg'}`,
          fileSize: estimatedFileSize,
          type: imageFile.type || 'image/jpeg',
        };

        useStore.getState().setPendingCroppedImage(croppedImage);
        logger.debug('Stored cropped image in MMKV:', {
          uri: croppedUri,
          fileName: croppedImage.fileName,
          fileSize: estimatedFileSize,
          type: croppedImage.type,
        });

        goBack();
      },
      setIsCropping,
      error => {
        errorService.reportError(error, {
          operation: 'ImageCrop.cropImage',
          imageUri: imageFile.uri,
          originalSize,
          displaySize: imageSize,
        });
        alertService.alert(t('labels.error'), t('profile.cropImageFailed'));
      },
    );
  };

  const resetTransforms = () => {
    scale.set(withSpring(1));
    startScale.set(1);
    offset.set(withSpring({ x: 0, y: 0 }));
    startOffset.set({ x: 0, y: 0 });
  };

  return (
    <Screen
      header={{
        title: t('profile.cropPhoto'),
        back: goBack,
        centerTitle: true,
        actions: [
          {
            icon: 'refresh',
            accessibilityLabel: t('a11y.resetCrop'),
            onPress: resetTransforms,
            disabled: isCropping,
            size: 20,
          },
        ],
      }}
      scroll="none"
      gutter="none"
    >
      <View style={styles.content}>
        <Text
          role="caption"
          align="center"
          tone="secondary"
          style={styles.instructions}
        >
          {!imageLoaded
            ? t('profile.loadingImage')
            : t('profile.cropInstructions')}
        </Text>

        <View style={styles.cropContainer}>
          {/* Crop overlay */}
          <View style={styles.cropOverlay} />

          {/* Image container with gesture detection */}
          <View style={styles.imageContainer}>
            {imageLoaded && imageSize.width > 0 ? (
              <GestureDetector gesture={composed}>
                <Animated.View
                  style={[
                    styles.animatedImageContainer,
                    animatedStyle,
                    {
                      width: CROP_SIZE,
                      height: CROP_SIZE,
                    },
                  ]}
                >
                  <LocalImage
                    uri={imageFile.uri}
                    style={[styles.image, imageSize]}
                  />
                </Animated.View>
              </GestureDetector>
            ) : (
              <View style={styles.cropSpinner}>
                <LocalImage
                  uri={imageFile.uri}
                  style={styles.imageFallback}
                  onLoad={handleImageLoad}
                />
                <View style={styles.loadingIconContainer}>
                  <Icon tone="textSecondary" name="image-outline" size={40} />
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <AppPressable
            onPress={handleCrop}
            style={styles.cropButton}
            disabled={isCropping || !imageLoaded}
          >
            <Text role="bodyStrong" style={styles.cropButtonText}>
              {isCropping ? t('profile.cropping') : t('profile.cropPhoto')}
            </Text>
          </AppPressable>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xl,
  },
  instructions: {
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  cropContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cropOverlay: {
    position: 'absolute',
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderColor: theme.colors.primary,
    borderWidth: theme.borderWidth.medium,
    borderRadius: CROP_SIZE / 2,
    borderCurve: 'continuous',
    zIndex: theme.zIndex.elevated,
    backgroundColor: 'transparent',
    pointerEvents: 'none',
  },
  imageContainer: {
    overflow: 'hidden',
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderRadius: CROP_SIZE / 2,
    borderCurve: 'continuous',
    backgroundColor: 'transparent',
  },
  animatedImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    // Dynamic size set by imageSize state
  },
  imageFallback: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    opacity: 0.01, // Nearly invisible but still triggers onLoad
  },
  cropSpinner: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  loadingIconContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    width: '100%',
  },
  cropButton: {
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  cropButtonText: {
    color: theme.colors.background,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default ImageCropScreen;
