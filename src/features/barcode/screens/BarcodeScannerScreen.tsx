import React, { useState, useRef, useEffect } from 'react';
import { View, Dimensions, Platform } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';

import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useBarcodeOutput } from '../hooks/useBarcodeOutput';
import { usePermission } from '#hooks/permissions/usePermission';
import { ThemedBarcodeMask } from '../components/ThemedBarcodeMask';
import { Button } from '#components/base/Button';
import { IconButton } from '#components/atoms/IconButton';
import { HapticService } from '#services/haptic/HapticService';
import { useHiddenStatusBar } from '#hooks/useHiddenStatusBar';
import type { BarcodeSource } from '#/types/navigation';
import { Text } from '#components/atoms/Text';

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
  const [flashEnabled, setFlashEnabled] = useState(false);

  // 1) Request permission once the initial check completes and status is undetermined
  useEffect(() => {
    if (!isCheckingPermission && !hasPermission && !isBlocked) {
      requestPermission();
    }
  }, [isCheckingPermission, hasPermission, isBlocked, requestPermission]);

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

    return () => {
      setIsActive(false);
      setScanning(false);
      // Drop the torch on blur so the next focus doesn't carry a stale 'on'
      // state, and so we never command the torch while the session tears down.
      setFlashEnabled(false);
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
      console.warn('Barcode scanner error:', error);
    },
  });

  const toggleFlash = () => setFlashEnabled(f => !f);
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
        torchMode={isActive && flashEnabled ? 'on' : 'off'}
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
