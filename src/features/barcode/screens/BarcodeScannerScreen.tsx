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
import { Button } from '#components/molecules/Button';
import { IconButton } from '#components/atoms/IconButton';
import { HapticService } from '#services/haptic/HapticService';
import { useHiddenStatusBar } from '#features/barcode/hooks/useHiddenStatusBar';

import type { BarcodeSource } from '#features/barcode/types';
import { Text } from '#components/atoms/Text';
import { logger } from '#/utils/environment';
import { motion } from '#/theme/foundations/motion';

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

  // 1) Ask for permission only after the screen SETTLES — on mount the OS
  //    dialog lands over the running stack push and the Add-to-Pantry sheet's
  //    blur-dismiss. A timer, not `transitionEnd` (unreachable through the root
  //    navigation's `EventMapCore`), covering both via their own constants.
  //    Armed on FOCUS: this screen is `React.lazy`, so its chunk can resolve at
  //    any point relative to the transition.
  const [screenSettled, setScreenSettled] = useState(false);
  const [onScannerFocus] = useState(() => () => {
    const handle = setTimeout(
      () => setScreenSettled(true),
      motion.timing.SLOW + motion.timing.STANDARD,
    );
    return () => clearTimeout(handle);
  });
  useFocusEffect(onScannerFocus);

  // Whether the request has been ISSUED AND RESOLVED. Until then nothing is
  // known about the user's intent, so the render below must not claim they
  // refused. `status` cannot answer this on Android: react-native-permissions
  // reports a never-requested permission as `RESULTS.DENIED` — that result
  // means "requestable", not "refused" — which `PermissionService` normalizes
  // to `'denied'`, indistinguishable from a real refusal. So track the ask.
  const [hasAskedPermission, setHasAskedPermission] = useState(false);

  useEffect(() => {
    if (!screenSettled) return;
    if (isCheckingPermission || hasPermission || isBlocked) return;
    let active = true;
    const ask = async () => {
      // Set on the throw path too: this flag is the only thing that lifts the
      // neutral screen, so swallowing a native rejection here would strand the
      // user on a blank screen with no way back.
      try {
        await requestPermission();
      } catch (e) {
        logger.warn('[BarcodeScanner] camera permission request failed', e);
      }
      if (active) setHasAskedPermission(true);
    };
    ask();
    return () => {
      active = false;
    };
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

  // 3) `useBarcodeOutput` normalizes VisionCamera's native output (iOS) and
  //    MLKit (Android) to `{ value, format }`. Formats are limited to the ones
  //    grocery items actually carry, for scan throughput.
  const barcodeOutput = useBarcodeOutput({
    formats: [
      'qr', // product info, coupons
      'ean-13', // most common grocery barcode
      'upc-a', // US standard
      'upc-e', // UPC compressed
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

  // A) Nothing truthful to show yet — a neutral screen, never the refusal UI:
  //    the request waits for `screenSettled`, so branch B would otherwise tell
  //    the user they refused something they were never asked. `isBlocked` is
  //    excluded because that IS a settled refusal.
  if (
    isCheckingPermission ||
    (!hasPermission && !isBlocked && !hasAskedPermission)
  ) {
    return <View style={styles.centeredContainer} />;
  }

  // B) No permission (denied/blocked) → ask the user
  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <Text role="heading" align="center" style={styles.messageText}>
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
        <Text role="heading" align="center" style={styles.messageText}>
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
        <Text role="heading" style={styles.headerTitle}>
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
        <Text role="bodyStrong" align="center" style={styles.instructionsText}>
          {hasScanned
            ? t('status.barcodeScanned')
            : t('instructions.pointCamera')}
        </Text>
        {!!isScanning && !hasScanned && (
          <Text
            role="caption"
            align="center"
            style={styles.subInstructionsText}
          >
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
            <Text role="label" style={styles.scanStatusText}>
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
    color: theme.colors.onScrim,
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
    zIndex: theme.zIndex.raised,
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
    color: theme.colors.onScrim,
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
    zIndex: theme.zIndex.raised,
    ...theme.shadows.lg,
  },
  instructionsText: {
    color: theme.colors.onScrim,
    marginBottom: theme.spacing.xs,
  },
  subInstructionsText: {
    color: theme.colors.onScrim,
    opacity: 0.85,
  },
  bottomControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    alignItems: 'center',
    zIndex: theme.zIndex.raised,
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
    color: theme.colors.onScrim,
  },
}));
