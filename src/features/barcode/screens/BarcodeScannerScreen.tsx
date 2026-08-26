import React, { useState, useRef, useEffect } from 'react';
import { View, Dimensions, Platform } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import {
  Camera,
  useCameraDevices,
  type TorchMode,
} from 'react-native-vision-camera';
import { useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';

import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useBarcodeOutput } from '../hooks/useBarcodeOutput';
import { usePermission } from '#hooks/permissions/usePermission';
import { ThemedBarcodeMask } from '../components/ThemedBarcodeMask';
import { Button } from '#components/atoms/Button';
import { IconButton } from '#components/atoms/IconButton';
import { HapticService } from '#services/haptic/HapticService';
import { useHiddenStatusBar } from '#hooks/useHiddenStatusBar';
import { TIMING } from '#/constants/animations';
import type { BarcodeSource } from '#/types/navigation';
import { Text } from '#components/atoms/Text';
import { logger } from '#/utils/environment';

const { height: screenHeight } = Dimensions.get('window');

export const BarcodeScannerScreen: React.FC<
  StaticScreenProps<
    | {
        source?: BarcodeSource;
        pantryId?: string;
        shoppingListId?: string;
      }
    | undefined
  >
> = ({ route }) => {
  const { t } = useTranslation();
  const { toSearchResults, goBack, navigation } = useAppNavigation();
  const { source, pantryId, shoppingListId } = route?.params || {};
  const devices = useCameraDevices();
  const device = devices.find(d => d.position === 'back');

  const {
    isChecking: isCheckingPermission,
    isGranted: hasPermission,
    isBlocked,
    request: requestPermission,
    openSettings,
  } = usePermission('camera');

  // barcode state/hooks
  const hasNavigatedRef = useRef(false);

  const { setScannedBarcode, setScanning, resetScanner, isScanning } =
    useBarcodeScanner();

  useHiddenStatusBar();

  // local UI state
  const [isActive, setIsActive] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  // `undefined` means we have not commanded the torch during this camera
  // session. VisionCamera's torch updater skips a nullish `torchMode`, so
  // leaving it undefined is what keeps it from firing `setTorchMode('off')`
  // the moment the controller exists — before the session has opened, which
  // CameraX rejects with "Camera is not active.".
  const [torch, setTorch] = useState<TorchMode | undefined>(undefined);
  const flashEnabled = torch === 'on';
  // The camera only accepts torch commands while its session is running, and
  // start/stop are both asynchronous. Track the session's own started/stopped
  // events so a command issued mid-transition is deferred rather than rejected.
  const [isSessionRunning, setIsSessionRunning] = useState(false);

  // 1) Request permission once the initial check completes and the status is
  //    undetermined — but only after this screen has SETTLED, never from a
  //    plain mount effect.
  //
  //    Firing it on mount raced two animations that were still running: the
  //    stack push, and the Add-to-Pantry sheet's blur-dismiss
  //    (`useStandardBottomSheet` dismisses on `blur`, which React Navigation
  //    emits when the navigation state changes, not when the animation
  //    finishes). The OS dialog landed on top of a half-dismissed sheet over a
  //    half-transitioned screen — the "camera permission overlaps Add to
  //    Pantry" report.
  //
  //    A timer rather than the native stack's own `transitionEnd`: that event
  //    is not reachable through the navigation type here (RootNavigator
  //    registers a global navigator, so `useNavigation()` resolves to the root
  //    navigation whose `EventMapCore` has no `transitionEnd`, and the generic
  //    does not override a global registration). The delay covers the push plus
  //    the sheet's dismiss, both bounded by the same constants that drive them.
  //
  //    Armed on FOCUS, not mount: this screen is `React.lazy`, so its chunk can
  //    resolve at any point relative to the transition, and focus is the one
  //    moment we know the screen is the active one.
  const [screenSettled, setScreenSettled] = useState(false);
  const [onScannerFocus] = useState(() => () => {
    const handle = setTimeout(
      () => setScreenSettled(true),
      TIMING.SLOW + TIMING.STANDARD,
    );
    return () => clearTimeout(handle);
  });
  useFocusEffect(onScannerFocus);

  useEffect(() => {
    if (!screenSettled) return;
    if (!isCheckingPermission && !hasPermission && !isBlocked) {
      requestPermission();
    }
  }, [
    screenSettled,
    isCheckingPermission,
    hasPermission,
    isBlocked,
    requestPermission,
  ]);

  // 2) When screen focuses *and* permission granted, turn scanner on;
  //    when unfocused, turn it off.
  useFocusEffect(() => {
    if (!hasPermission) {
      // we'll show the "grant permission" UI instead
      return () => {};
    }
    hasNavigatedRef.current = false;
    setHasScanned(false);
    setIsActive(true);
    setScanning(true);
    // Covers a focus where the session never started, so onStopped never ran.
    // Writing undefined can't emit a native command, so this is safe at any
    // point in the session's lifecycle.
    setTorch(undefined);

    return () => {
      setIsActive(false);
      setScanning(false);
    };
  });

  // 3) Set up the barcode-scanner output. On iOS this resolves to
  //    VisionCamera's built-in useObjectOutput (native AVCaptureMetadataOutput,
  //    no MLKit). On Android it falls through to react-native-vision-camera-
  //    barcode-scanner (MLKit). useBarcodeOutput normalizes both sides to
  //    `{ value, format }` with format ∈ 'qr' | 'ean-13' | 'ean-8' | 'upc-a'
  //    | 'upc-e' so callers don't see the platform difference.
  //
  // PERFORMANCE: Limited to most common barcode types for grocery items.
  const barcodeOutput = useBarcodeOutput({
    formats: [
      'qr', // QR codes - common for product info, coupons
      'ean-13', // European Article Number - most common grocery barcode
      'upc-a', // Universal Product Code - US standard
      'upc-e', // UPC compressed format
    ],
    onBarcodeScanned: ({ value, format }) => {
      if (!isActive || hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      setHasScanned(true);
      setScanning(false);

      // Haptic feedback on successful barcode scan
      HapticService.success();

      setScannedBarcode(value);
      toSearchResults({
        barcode: value,
        format,
        source,
        pantryId,
        shoppingListId,
      });
    },
    onError: error => {
      logger.warn('[BarcodeScanner] Scanner error:', error);
    },
  });

  const toggleFlash = () => setTorch(mode => (mode === 'on' ? 'off' : 'on'));

  const handleSessionStarted = () => setIsSessionRunning(true);
  const handleSessionStopped = () => {
    setIsSessionRunning(false);
    // Leave the next session dark rather than resuming with the torch lit.
    setTorch(undefined);
  };
  const handleCameraError = (error: Error) => {
    logger.error('[BarcodeScanner] Camera error:', error);
  };

  const resetScan = () => {
    setHasScanned(false);
    resetScanner();
    setScanning(true);
    hasNavigatedRef.current = false;
  };

  const handleGoBack = () => {
    // Dismiss the Barcode modal stack to reveal Home
    const rootNavigator = navigation.getParent();
    if (rootNavigator?.canGoBack()) {
      rootNavigator.goBack();
    } else {
      goBack();
    }
  };

  // --- RENDER FALLBACKS ---

  // A) Still checking permission status — show black screen to prevent flash
  if (isCheckingPermission) {
    return <View style={styles.centeredContainer} />;
  }

  // B) No permission (denied/blocked) → ask the user
  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <Text
          size="lg"
          weight="semibold"
          align="center"
          style={styles.messageText}
        >
          {t('errors.cameraPermission')}
        </Text>
        {isBlocked ? (
          <Button onPress={openSettings} variant="primary" size="medium">
            {t('labels.openSettings')}
          </Button>
        ) : (
          <Button onPress={requestPermission} variant="primary" size="medium">
            {t('labels.grantPermission')}
          </Button>
        )}
        <Button onPress={handleGoBack} variant="ghost" size="medium">
          {t('labels.cancel')}
        </Button>
      </View>
    );
  }

  // C) No camera hardware
  if (!device) {
    return (
      <View style={styles.centeredContainer}>
        <Text
          size="lg"
          weight="semibold"
          align="center"
          style={styles.messageText}
        >
          {t('errors.noCameraDevice')}
        </Text>
        <Button onPress={handleGoBack} variant="primary" size="medium">
          {t('labels.goBack')}
        </Button>
      </View>
    );
  }

  // D) Permission granted & device ready → show scanner
  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        device={device}
        isActive={isActive}
        outputs={[barcodeOutput]}
        torchMode={isSessionRunning ? torch : undefined}
        onStarted={handleSessionStarted}
        onStopped={handleSessionStopped}
        onError={handleCameraError}
        enableNativeZoomGesture
      />

      <ThemedBarcodeMask
        width={280}
        height={200}
        showAnimatedLine={!!isScanning && !hasScanned}
        lineAnimationDuration={2000}
      />

      <View style={styles.header}>
        <IconButton
          name="close"
          onPress={handleGoBack}
          size="md"
          style={styles.headerButton}
          accessibilityLabel={t('barcodeScanner.closeScanner')}
        />
        <Text size="lg" weight="semibold" style={styles.headerTitle}>
          {t('labels.scanBarcode')}
        </Text>
        <IconButton
          name={flashEnabled ? 'flash' : 'flash-off'}
          onPress={toggleFlash}
          size="md"
          style={styles.headerButton}
          accessibilityLabel={
            flashEnabled
              ? t('barcodeScanner.flashOff')
              : t('barcodeScanner.flashOn')
          }
        />
      </View>

      <View style={styles.instructionsContainer}>
        <Text
          size="md"
          weight="semibold"
          align="center"
          style={styles.instructionsText}
        >
          {hasScanned
            ? t('status.barcodeScanned')
            : t('instructions.pointCamera')}
        </Text>
        {!!isScanning && !hasScanned && (
          <Text size="sm" align="center" style={styles.subInstructionsText}>
            {t('instructions.barcodeVisible')}
          </Text>
        )}
      </View>

      <View style={styles.bottomControls}>
        {hasScanned ? (
          <Button onPress={resetScan} variant="primary" size="medium">
            {t('labels.scanAnother')}
          </Button>
        ) : (
          <View style={styles.scanIndicator}>
            <View
              style={[styles.scanDot, isScanning && styles.scanDotActive]}
            />
            <Text size="sm" weight="medium" style={styles.scanStatusText}>
              {isScanning ? t('status.scanning') : t('status.readyToScan')}
            </Text>
          </View>
        )}
      </View>
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
  },
  instructionsContainer: {
    position: 'absolute',
    top: screenHeight * 0.25,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
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
    marginBottom: theme.spacing.xs,
  },
  subInstructionsText: {
    color: theme.colors.white,
    opacity: 0.85,
  },
  bottomControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    alignItems: 'center',
    zIndex: 1,
  },
  scanIndicator: { alignItems: 'center' },
  scanDot: {
    width: 12,
    height: 12,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.overlays.medium,
    marginBottom: theme.spacing.sm,
  },
  scanDotActive: { backgroundColor: theme.colors.primary },
  scanStatusText: {
    color: theme.colors.white,
  },
}));
