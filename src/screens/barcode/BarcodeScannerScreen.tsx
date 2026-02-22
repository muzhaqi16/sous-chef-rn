import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  Camera,
  useCameraDevices,
  useCodeScanner,
} from 'react-native-vision-camera';
import { useFocusEffect } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';

import { useBarcodeScanner } from '#hooks/useBarcodeScanner';
import { usePermission } from '#hooks/permissions/usePermission';
import BarcodeMask from '#components/organisms/BarcodeMask';
import { Button } from '#components/base/Button';
import { IconButton } from '#components/atoms/IconButton';
import { HapticService } from '#services/haptic/HapticService';

const { height: screenHeight } = Dimensions.get('window');

export const BarcodeScannerScreen: React.FC<StaticScreenProps<{
  source?: 'pantry' | 'shoppingList';
  pantryId?: string;
  shoppingListId?: string;
} | undefined>> = ({ route }) => {
  const { navigate, goBack, navigation } = useAppNavigation();
  const { source, pantryId, shoppingListId } = route?.params || {};
  const devices = useCameraDevices();
  const device = useMemo(
    () => devices.find(d => d.position === 'back'),
    [devices],
  );

  const { theme } = useUnistyles();

  const { isGranted: hasPermission, isBlocked, request: requestPermission, openSettings } = usePermission('camera');

  // barcode state/hooks
  const hasNavigatedRef = useRef(false);

  const { setScannedBarcode, setScanning, resetScanner, isScanning } =
    useBarcodeScanner();

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
  useFocusEffect(
    useCallback(() => {
      if (!hasPermission) {
        // we'll show the "grant permission" UI instead
        return () => {};
      }
      hasNavigatedRef.current = false;
      setHasScanned(false);
      setIsActive(true);
      setScanning(true);

      // Hide status bar for immersive camera interface
      StatusBar.setHidden(true, 'slide');

      return () => {
        setIsActive(false);
        setScanning(false);
        // Show status bar when leaving
        StatusBar.setHidden(false, 'slide');
        // Don't set barStyle - let App.tsx handle theme-aware styling
      };
    }, [hasPermission, setScanning]),
  );

  // 3) Set up the VisionCamera code‐scanner callback
  // PERFORMANCE: Limited to most common barcode types for grocery items
  // QR codes (quick response codes), EAN-13 (European), UPC-A/E (US standard)
  const codeScanner = useCodeScanner({
    codeTypes: [
      'qr', // QR codes - common for product info, coupons
      'ean-13', // European Article Number - most common grocery barcode
      'upc-a', // Universal Product Code - US standard
      'upc-e', // UPC compressed format
    ],
    onCodeScanned: codes => {
      if (!isActive || hasNavigatedRef.current || !codes.length) return;

      const { value, type } = codes[0];
      if (value) {
        hasNavigatedRef.current = true;
        setHasScanned(true);
        setScannedBarcode(value);
        setScanning(false);

        // Haptic feedback on successful barcode scan
        HapticService.success();

        navigate('SearchResults', {
          barcode: value,
          format: type,
          source,
          pantryId,
          shoppingListId,
        });
      }
    },
  });

  const toggleFlash = useCallback(() => setFlashEnabled(f => !f), []);
  const resetScan = useCallback(() => {
    setHasScanned(false);
    resetScanner();
    setScanning(true);
    hasNavigatedRef.current = false;
  }, [resetScanner, setScanning]);

  const handleGoBack = useCallback(() => {
    // Simply pop the Barcode stack to reveal Home
    // This preserves Home's state without triggering remounts
    const rootNavigator = navigation.getParent();
    if (rootNavigator?.canGoBack()) {
      rootNavigator.goBack();
    } else {
      goBack();
    }
  }, [navigation, goBack]);

  // --- RENDER FALLBACKS ---

  // A) No permission yet (or denied/blocked) → ask the user
  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.messageText}>
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
        <Text style={styles.messageText}>No camera device found</Text>
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
        codeScanner={codeScanner}
        torch={flashEnabled ? 'on' : 'off'}
        enableZoomGesture
      />

      <BarcodeMask
        width={280}
        height={200}
        edgeColor={theme.colors.primary}
        backgroundColor={theme.colors.overlay}
        showAnimatedLine={isScanning && !hasScanned}
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
        <Text style={styles.headerTitle}>Scan Barcode</Text>
        <IconButton
          name={flashEnabled ? 'flash-on' : 'flash-off'}
          onPress={toggleFlash}
          size="md"
          style={styles.headerButton}
          accessibilityLabel={flashEnabled ? 'Turn flash off' : 'Turn flash on'}
        />
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsText}>
          {hasScanned
            ? 'Barcode scanned! Navigating…'
            : 'Point your camera at a barcode'}
        </Text>
        {isScanning && !hasScanned && (
          <Text style={styles.subInstructionsText}>
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
            <Text style={styles.scanStatusText}>
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
    top: screenHeight * 0.25,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    alignItems: 'center',
    zIndex: 1,
  },
  instructionsText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subInstructionsText: {
    color: theme.colors.overlays.light,
    fontSize: theme.fonts.size.sm,
    textAlign: 'center',
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
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
  },
}));
