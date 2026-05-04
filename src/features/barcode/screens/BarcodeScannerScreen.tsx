import React, { useState, useRef, useEffect } from 'react';
import { View, Dimensions, Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import { useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';

import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { usePermission } from '#hooks/permissions/usePermission';
import BarcodeMask from '#components/organisms/BarcodeMask';
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
        /** When set, the scanner pops back to the named screen with the
         *  detected UPC as a route param instead of opening SearchResults. */
        returnTo?: 'identify-form';
      }
    | undefined
  >
> = ({ route }) => {
  const { navigate, goBack, navigation } = useAppNavigation();
  const { source, pantryId, shoppingListId, returnTo } = route?.params || {};
  const devices = useCameraDevices();
  const device = devices.find(d => d.position === 'back');

  const { theme } = useUnistyles();

  const {
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

  // 1) On mount, ask for camera permission if we don't have it yet
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

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
    };
  });

  // 3) Set up the VisionCamera barcode-scanner output (MLKit on Android, Vision on iOS)
  // PERFORMANCE: Limited to most common barcode types for grocery items.
  const barcodeOutput = useBarcodeScannerOutput({
    barcodeFormats: [
      'qr-code', // QR codes - common for product info, coupons
      'ean-13', // European Article Number - most common grocery barcode
      'upc-a', // Universal Product Code - US standard
      'upc-e', // UPC compressed format
    ],
    onBarcodeScanned: barcodes => {
      if (!isActive || hasNavigatedRef.current || !barcodes.length) return;

      const { rawValue: value, format } = barcodes[0];
      // Map 'qr-code' back to 'qr' so downstream consumers (UpcFormat mapping,
      // navigation params) receive the format string they were written for.
      const type = format === 'qr-code' ? 'qr' : format;
      if (value) {
        hasNavigatedRef.current = true;
        setHasScanned(true);
        setScanning(false);

        // Haptic feedback on successful barcode scan
        HapticService.success();

        if (returnTo === 'identify-form') {
          // Pop back to the in-progress Identify form with the UPC; merge
          // semantics mean the form stays mounted and existing fields
          // survive the round-trip.
          navigate('IdentifiedItemForm', { upc: value });
          return;
        }

        setScannedBarcode(value);
        navigate('SearchResults', {
          barcode: value,
          format: type,
          source,
          pantryId,
          shoppingListId,
        });
      }
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

  // A) No permission yet (or denied/blocked) → ask the user
  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <Text
          size="lg"
          weight="semibold"
          align="center"
          style={styles.messageText}
        >
          Camera access is required to scan barcodes.
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

  // B) No camera hardware
  if (!device) {
    return (
      <View style={styles.centeredContainer}>
        <Text
          size="lg"
          weight="semibold"
          align="center"
          style={styles.messageText}
        >
          No camera device found
        </Text>
        <Button onPress={handleGoBack} variant="primary" size="medium">
          Go Back
        </Button>
      </View>
    );
  }

  // C) Permission granted & device ready → show scanner
  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        device={device}
        isActive={isActive}
        outputs={[barcodeOutput]}
        torchMode={flashEnabled ? 'on' : 'off'}
        enableNativeZoomGesture
      />

      <BarcodeMask
        width={280}
        height={200}
        edgeColor={theme.colors.primary}
        backgroundColor={theme.colors.overlay}
        showAnimatedLine={!!isScanning && !hasScanned}
        lineAnimationDuration={2000}
      />

      <View style={styles.header}>
        <IconButton
          name="close"
          onPress={handleGoBack}
          size="md"
          style={styles.headerButton}
          accessibilityLabel="Close scanner"
        />
        <Text size="lg" weight="semibold" style={styles.headerTitle}>
          Scan Barcode
        </Text>
        <IconButton
          name={flashEnabled ? 'flash' : 'flash-off'}
          onPress={toggleFlash}
          size="md"
          style={styles.headerButton}
          accessibilityLabel={flashEnabled ? 'Turn flash off' : 'Turn flash on'}
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
            ? 'Barcode scanned! Navigating…'
            : 'Point your camera at a barcode'}
        </Text>
        {!!isScanning && !hasScanned && (
          <Text size="sm" align="center" style={styles.subInstructionsText}>
            Make sure the barcode is clearly visible
          </Text>
        )}
      </View>

      <View style={styles.bottomControls}>
        {hasScanned ? (
          <Button onPress={resetScan} variant="primary" size="medium">
            Scan Another
          </Button>
        ) : (
          <View style={styles.scanIndicator}>
            <View
              style={[styles.scanDot, isScanning && styles.scanDotActive]}
            />
            <Text size="sm" weight="medium" style={styles.scanStatusText}>
              {isScanning ? 'Scanning…' : 'Ready to scan'}
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
    alignItems: 'center',
    zIndex: 1,
  },
  instructionsText: {
    color: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  subInstructionsText: {
    color: theme.colors.overlays.light,
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
