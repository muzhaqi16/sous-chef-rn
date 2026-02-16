import React, { useState, useCallback } from 'react';
import {
  View,
  Pressable,
  Text,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  clamp,
} from 'react-native-reanimated';
import { useRoute } from '@react-navigation/native';
import { useSafeNavigation } from '#hooks/navigation/useSafeNavigation';
import { Icon } from '#utils/iconUtils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { MAX_PROFILE_SIZE } from '#utils/imageValidation';
import ImageEditor from '@react-native-community/image-editor';
import { ImageFile } from '#components/molecules/ImagePicker';
import { storage } from '#/storage/mmkv';

const { width: screenWidth } = Dimensions.get('window');
const CROP_SIZE = Math.min(screenWidth * 0.8, 300);

export const ImageCropScreen = () => {
  const { goBack } = useSafeNavigation();
  const route = useRoute();
  const { imageFile } = route.params as { imageFile: ImageFile };
  const { theme } = useUnistyles();

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isCropping, setIsCropping] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Shared values for animations
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const offset = useSharedValue({ x: 0, y: 0 });
  const startOffset = useSharedValue({ x: 0, y: 0 });

  // Get image dimensions when loaded
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);

    Image.getSize(imageFile.uri, (width, height) => {
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

      setImageSize({ width: displayWidth, height: displayHeight });

      // Reset transforms
      scale.value = 1;
      startScale.value = 1;
      offset.value = { x: 0, y: 0 };
      startOffset.value = { x: 0, y: 0 };
    });
  }, [imageFile.uri, scale, startScale, offset, startOffset]);

  // Create pinch gesture
  const pinch = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      startScale.value = scale.value;
    })
    .onUpdate(e => {
      'worklet';
      scale.value = clamp(startScale.value * e.scale, 0.5, 3);
    });

  // Create pan gesture
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      'worklet';
      startOffset.value = { x: offset.value.x, y: offset.value.y };
    })
    .onUpdate(e => {
      'worklet';
      // Calculate bounds based on current scale and image size
      const scaledWidth = (imageSize.width || CROP_SIZE) * scale.value;
      const scaledHeight = (imageSize.height || CROP_SIZE) * scale.value;

      const maxX = Math.max(0, (scaledWidth - CROP_SIZE) / 2);
      const maxY = Math.max(0, (scaledHeight - CROP_SIZE) / 2);

      const newX = clamp(startOffset.value.x + e.translationX, -maxX, maxX);
      const newY = clamp(startOffset.value.y + e.translationY, -maxY, maxY);

      offset.value = { x: newX, y: newY };
    });

  // Compose gestures
  const composed = Gesture.Simultaneous(pan, pinch);

  // Animated style
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: offset.value.x },
        { translateY: offset.value.y },
        { scale: scale.value },
      ],
    };
  });

  const handleCrop = async () => {
    if (!imageSize.width || !imageSize.height) {
      Alert.alert('Error', 'Image not loaded properly');
      return;
    }

    setIsCropping(true);
    try {
      // Get the original image dimensions
      const originalImageSize = await new Promise<{
        width: number;
        height: number;
      }>((resolve, reject) => {
        Image.getSize(
          imageFile.uri,
          (width, height) => resolve({ width, height }),
          error => reject(error),
        );
      });

      // Calculate the center position of the crop area relative to the image
      const cropCenterX = CROP_SIZE / 2;
      const cropCenterY = CROP_SIZE / 2;

      // Calculate where the image center is positioned on screen after transforms
      const imageCenterX = CROP_SIZE / 2 + offset.value.x;
      const imageCenterY = CROP_SIZE / 2 + offset.value.y;

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
          (offsetFromImageCenter.x * scaleRatio) / scale.value,
      );
      const cropY = Math.max(
        0,
        originalImageSize.height / 2 +
          (offsetFromImageCenter.y * scaleRatio) / scale.value,
      );

      // Calculate crop size in original image coordinates
      const cropSizeInOriginal = (CROP_SIZE * scaleRatio) / scale.value;

      // Ensure crop doesn't go outside image boundaries
      const finalCropX = Math.max(
        0,
        Math.min(
          cropX - cropSizeInOriginal / 2,
          originalImageSize.width - cropSizeInOriginal,
        ),
      );
      const finalCropY = Math.max(
        0,
        Math.min(
          cropY - cropSizeInOriginal / 2,
          originalImageSize.height - cropSizeInOriginal,
        ),
      );
      const finalCropSize = Math.min(
        cropSizeInOriginal,
        originalImageSize.width - finalCropX,
        originalImageSize.height - finalCropY,
      );

      const cropData = {
        offset: {
          x: finalCropX,
          y: finalCropY,
        },
        size: {
          width: finalCropSize,
          height: finalCropSize,
        },
        displaySize: {
          width: CROP_SIZE,
          height: CROP_SIZE,
        },
        resizeMode: 'contain' as const,
      };

      const { uri: croppedUri } = await ImageEditor.cropImage(
        imageFile.uri,
        cropData,
      );

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

      // Store to MMKV
      storage.set('temp_cropped_image', JSON.stringify(croppedImage));
      console.log('Stored cropped image in MMKV:', {
        uri: croppedUri,
        fileName: croppedImage.fileName,
        fileSize: estimatedFileSize,
        type: croppedImage.type,
      });

      goBack();
    } catch (error) {
      console.error('Crop failed:', error);
      Alert.alert('Error', 'Failed to crop image. Please try again.');
    } finally {
      setIsCropping(false);
    }
  };

  const resetTransforms = () => {
    scale.value = withSpring(1);
    startScale.value = 1;
    offset.value = withSpring({ x: 0, y: 0 });
    startOffset.value = { x: 0, y: 0 };
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={({pressed}) => [styles.headerButton, pressed && styles.pressed]}
          disabled={isCropping}
        >
          <Icon
            color={theme.colors.textPrimary}
            name="chevron-left"
            size={24}
            library="Feather"
          />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text
            style={[styles.headerTitle, { color: theme.colors.textPrimary }]}
          >
            Crop Photo
          </Text>
        </View>

        <Pressable
          onPress={resetTransforms}
          style={({pressed}) => [styles.headerButton, pressed && styles.pressed]}
          disabled={isCropping}
        >
          <Icon
            color={theme.colors.textPrimary}
            name="refresh-cw"
            size={20}
            library="Feather"
          />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text
          style={[styles.instructions, { color: theme.colors.textSecondary }]}
        >
          {!imageLoaded
            ? 'Loading image...'
            : 'Pinch to zoom, drag to move. The circular view area will be your profile photo.'}
        </Text>

        <View style={styles.cropContainer}>
          {/* Crop overlay */}
          <View
            style={[
              styles.cropOverlay,
              {
                width: CROP_SIZE,
                height: CROP_SIZE,
                borderColor: theme.colors.primary,
              },
            ]}
          />

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
                  <Image
                    source={{ uri: imageFile.uri }}
                    style={[styles.image, imageSize]}
                    resizeMode="cover"
                  />
                </Animated.View>
              </GestureDetector>
            ) : (
              <View style={styles.loadingContainer}>
                <Image
                  source={{ uri: imageFile.uri }}
                  style={styles.imageFallback}
                  onLoad={handleImageLoad}
                  resizeMode="cover"
                />
                <View style={styles.loadingIconContainer}>
                  <Icon
                    color={theme.colors.textSecondary}
                    name="image"
                    size={40}
                    library="Feather"
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            onPress={handleCrop}
            style={({pressed}) => [
              styles.cropButton,
              { backgroundColor: theme.colors.primary },
              pressed && styles.pressed,
            ]}
            disabled={isCropping || !imageLoaded}
          >
            <Text
              style={[
                styles.cropButtonText,
                { color: theme.colors.background },
              ]}
            >
              {isCropping ? 'Cropping...' : 'Crop Photo'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerButton: {
    padding: theme.spacing.sm,
    width: 40,
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
  },
  debugText: {
    fontSize: theme.typography.fontSize.xs - 2,
    marginTop: 2,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xl,
  },
  instructions: {
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    fontSize: theme.typography.fontSize.sm,
  },
  cropContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cropOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: CROP_SIZE / 2,
    zIndex: 2,
    backgroundColor: 'transparent',
    pointerEvents: 'none',
  },
  imageContainer: {
    overflow: 'hidden',
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderRadius: CROP_SIZE / 2,
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
  loadingContainer: {
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
    alignItems: 'center',
  },
  cropButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
}));

export default ImageCropScreen;
