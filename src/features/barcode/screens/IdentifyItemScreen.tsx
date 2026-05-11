import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Platform,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  TextInput,
} from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import {
  Camera,
  useCameraDevices,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { useFocusEffect } from '@react-navigation/native';
import type { StaticScreenProps } from '@react-navigation/native';

import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { usePermission } from '#hooks/permissions/usePermission';
import { useOcrScanner } from '#hooks/useOcrScanner';
import { useHiddenStatusBar } from '#hooks/useHiddenStatusBar';
import { Button } from '#components/base/Button';
import { IconButton } from '#components/atoms/IconButton';
import BarcodeMask from '#components/organisms/BarcodeMask';

const ThemedBarcodeMask = withUnistyles(BarcodeMask, theme => ({
  edgeColor: theme.colors.primary,
  backgroundColor: theme.colors.overlay,
}));

const ThemedTextInput = withUnistyles(TextInput, theme => ({
  placeholderTextColor: theme.colors.textTertiary,
}));
import { HapticService } from '#services/haptic/HapticService';
import { Telemetry } from '#services/telemetry';
import { executeQuery } from '#/utils/compilerSafeWrappers';
import type { BarcodeSource } from '#/types/navigation';

// Portrait cutout sized from the screen: product labels are taller than they
// are wide, so reuse BarcodeMask with different dimensions than the barcode
// scanner (which uses a short landscape rect).
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FRAME_WIDTH = Math.round(SCREEN_WIDTH * 0.75);
const FRAME_HEIGHT = Math.round(SCREEN_HEIGHT * 0.5);

const toTitleCase = (s: string): string =>
  s.toLowerCase().replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());

const appendWord = (current: string, word: string): string => {
  const clean = current.trim();
  return clean ? `${clean} ${word}` : word;
};

export const IdentifyItemScreen: React.FC<
  StaticScreenProps<
    | {
        source?: BarcodeSource;
        pantryId?: string;
        shoppingListId?: string;
      }
    | undefined
  >
> = ({ route }) => {
  const { goBack, navigation, toIdentifiedItemForm } = useAppNavigation();
  const { source, pantryId, shoppingListId } = route?.params || {};

  const devices = useCameraDevices();
  const device = devices.find(d => d.position === 'back');

  const photoOutput = usePhotoOutput();

  const {
    isGranted: hasPermission,
    isBlocked,
    request: requestPermission,
    openSettings,
  } = usePermission('camera');

  useHiddenStatusBar();

  const {
    candidates,
    netWeights: detectedNetWeights,
    isReading: isReadingText,
    failed: ocrFailed,
    scan,
    reset: resetOcr,
  } = useOcrScanner();

  const [isActive, setIsActive] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [brandInput, setBrandInput] = useState('');

  useEffect(() => {
    Telemetry.trackEvent('identify_opened', { source: source ?? 'unknown' });
  }, [source]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useFocusEffect(() => {
    if (!hasPermission) {
      return () => {};
    }
    setIsActive(true);
    return () => {
      setIsActive(false);
    };
  });

  const runOcr = async (uri: string) => {
    const next = await scan(uri);
    if (next === null) {
      Telemetry.trackEvent('identify_ocr_error');
    } else {
      Telemetry.trackEvent('identify_text_detected', {
        candidateCount: next.candidates.length,
        netWeightCount: next.netWeights.length,
      });
    }
  };

  const handleShutter = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    const photo = await executeQuery(
      () => photoOutput.capturePhotoToFile({ flashMode: 'off' }, {}),
      'IdentifyItemScreen.takePhoto',
    );
    setIsCapturing(false);
    if (!photo) return;

    const uri =
      Platform.OS === 'android' ? `file://${photo.filePath}` : photo.filePath;
    setPhotoUri(uri);
    setIsActive(false);
    HapticService.success();
    Telemetry.trackEvent('identify_photo_taken');

    await runOcr(uri);
  };

  const handleRetry = async () => {
    if (!photoUri) return;
    await runOcr(photoUri);
  };

  const handleRetake = () => {
    setPhotoUri(null);
    resetOcr();
    setNameInput('');
    setBrandInput('');
    setIsActive(true);
  };

  const appendToName = (text: string) => {
    setNameInput(prev => appendWord(prev, toTitleCase(text)));
  };

  const appendToBrand = (text: string) => {
    setBrandInput(prev => appendWord(prev, toTitleCase(text)));
  };

  const handleConfirm = () => {
    const trimmedName = nameInput.trim();
    if (!trimmedName) return;
    const trimmedBrand = brandInput.trim();
    HapticService.success();
    Telemetry.trackEvent('identify_confirmed', {
      hasBrand: !!trimmedBrand,
      netWeightCount: detectedNetWeights.length,
    });
    toIdentifiedItemForm({
      name: trimmedName,
      brandName: trimmedBrand || undefined,
      netWeights:
        detectedNetWeights.length > 0 ? detectedNetWeights : undefined,
      source,
      pantryId,
      shoppingListId,
    });
  };

  const handleGoBack = () => {
    const rootNavigator = navigation.getParent();
    if (rootNavigator?.canGoBack()) {
      rootNavigator.goBack();
    } else {
      goBack();
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.messageText}>
          Camera access is required to identify items.
        </Text>
        {isBlocked ? (
          <Button onPress={openSettings} variant="primary" size="medium">
            Open Settings
          </Button>
        ) : (
          <Button onPress={requestPermission} variant="primary" size="medium">
            Grant Permission
          </Button>
        )}
        <Button onPress={handleGoBack} variant="ghost" size="medium">
          Cancel
        </Button>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.messageText}>No camera device found</Text>
        <Button onPress={handleGoBack} variant="primary" size="medium">
          Go Back
        </Button>
      </View>
    );
  }

  const shutterDisabled = isCapturing || !!photoUri;

  return (
    <View style={styles.container}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.preview} />
      ) : (
        <>
          <Camera
            style={styles.camera}
            device={device}
            isActive={isActive}
            outputs={[photoOutput]}
          />
          <ThemedBarcodeMask
            width={FRAME_WIDTH}
            height={FRAME_HEIGHT}
            showAnimatedLine={false}
          />
        </>
      )}

      <View style={styles.header}>
        <IconButton
          name="close"
          onPress={handleGoBack}
          size="md"
          style={styles.headerButton}
          accessibilityLabel="Close identifier"
        />
        <Text style={styles.headerTitle}>Identify Item</Text>
        <View style={styles.headerButton} />
      </View>

      {!photoUri && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            Point your camera at the product label
          </Text>
          <Text style={styles.subInstructionsText}>
            Frame the brand and product name, then tap the shutter
          </Text>
        </View>
      )}

      {!photoUri && (
        <View style={styles.shutterContainer}>
          <Pressable
            accessibilityLabel="Capture photo"
            onPress={handleShutter}
            disabled={shutterDisabled}
            style={({ pressed }) => [
              styles.shutter,
              shutterDisabled && styles.shutterDisabled,
              pressed && !shutterDisabled && styles.shutterPressed,
            ]}
          >
            {isCapturing ? (
              <ActivityIndicator color="white" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>
        </View>
      )}

      {!!photoUri && (
        <View style={styles.resultsPanel}>
          {isReadingText ? (
            <View style={styles.resultsLoading}>
              <ActivityIndicator />
              <Text style={styles.resultsLoadingText}>Reading text…</Text>
            </View>
          ) : ocrFailed ? (
            <View style={styles.resultsLoading}>
              <Text style={styles.resultsLoadingText}>
                Couldn't read text from this photo.
              </Text>
              <View style={styles.resultsActions}>
                <Button onPress={handleRetake} variant="ghost" size="medium">
                  Retake
                </Button>
                <Button onPress={handleRetry} variant="primary" size="medium">
                  Try again
                </Button>
              </View>
            </View>
          ) : candidates.length === 0 ? (
            <View style={styles.resultsLoading}>
              <Text style={styles.resultsLoadingText}>
                No text detected. Try again with better lighting.
              </Text>
              <Button onPress={handleRetake} variant="primary" size="medium">
                Retake
              </Button>
            </View>
          ) : (
            <>
              <Text style={styles.resultsTitle} accessibilityRole="header">
                Item name
              </Text>
              <PickerInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Tap chips or type..."
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {candidates.map(c => (
                  <Chip
                    key={`name-${c.text}`}
                    label={c.text}
                    field="name"
                    onPress={() => appendToName(c.text)}
                  />
                ))}
              </ScrollView>

              <Text style={styles.resultsTitle} accessibilityRole="header">
                Brand (optional)
              </Text>
              <PickerInput
                value={brandInput}
                onChangeText={setBrandInput}
                placeholder="Tap chips or type..."
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {candidates.map(c => (
                  <Chip
                    key={`brand-${c.text}`}
                    label={c.text}
                    field="brand"
                    onPress={() => appendToBrand(c.text)}
                  />
                ))}
              </ScrollView>

              <View style={styles.resultsActions}>
                <Button onPress={handleRetake} variant="ghost" size="medium">
                  Retake
                </Button>
                <Button
                  onPress={handleConfirm}
                  variant="primary"
                  size="medium"
                  disabled={!nameInput.trim()}
                >
                  Continue
                </Button>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
};

interface ChipProps {
  label: string;
  field: 'name' | 'brand';
  onPress: () => void;
}

const Chip: React.FC<ChipProps> = ({ label, field, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    accessibilityRole="button"
    accessibilityLabel={`Append ${label} to ${field}`}
  >
    <Text style={styles.chipText}>{label}</Text>
  </Pressable>
);

interface PickerInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

const PickerInput: React.FC<PickerInputProps> = ({
  value,
  onChangeText,
  placeholder,
}) => {
  return (
    <View style={styles.pickerInputRow}>
      <ThemedTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.pickerInput}
        autoCapitalize="words"
        autoCorrect={false}
      />
      {!!value && (
        <Pressable
          onPress={() => onChangeText('')}
          style={styles.pickerClear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear"
        >
          <Text style={styles.pickerClearText}>✕</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
  },
  camera: { flex: 1 },
  preview: { flex: 1, resizeMode: 'cover' },
  centeredContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  messageText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    zIndex: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.overlays.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
  },
  instructionsContainer: {
    position: 'absolute',
    top: 100,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    zIndex: 1,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 12,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.3)',
      },
    ],
  },
  instructionsText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subInstructionsText: {
    color: theme.colors.white,
    opacity: 0.85,
    fontSize: theme.fonts.size.sm,
    textAlign: 'center',
  },
  shutterContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: theme.radii.full,
    borderWidth: 4,
    borderColor: theme.colors.white,
    backgroundColor: theme.colors.overlays.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.white,
  },
  shutterDisabled: { opacity: 0.4 },
  shutterPressed: { opacity: 0.8 },
  resultsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : theme.spacing.lg,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    zIndex: 2,
  },
  resultsLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  resultsLoadingText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.size.sm,
    textAlign: 'center',
  },
  resultsTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  chipRow: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.overlays.light,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipPressed: {
    opacity: theme.opacity.pressed,
  },
  chipText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
  },
  pickerInputRow: {
    position: 'relative',
    marginBottom: theme.spacing.sm,
  },
  pickerInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingRight: 40,
    paddingVertical: theme.spacing['3'],
    fontSize: theme.fonts.size.base,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
  },
  pickerClear: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerClearText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  resultsActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
}));
