import React, {useState, useRef, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevices,
  useCodeScanner,
  useCameraPermission,
} from 'react-native-vision-camera';
import {useFocusEffect} from '@react-navigation/native';
import {useNavigationFlow} from '#hooks';

import {useBarcodeScanner} from '#hooks';
import BarcodeMask from '#components/organisms/BarcodeMask';
import {BarcodeScannerNavProp, BarcodeScannerScreenProps} from '#navigation';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

export const BarcodeScannerScreen: React.FC<BarcodeScannerScreenProps> = ({
  route,
}) => {
  const {navigateWithinStack, goBack} = useNavigationFlow();
  const {source, pantryId, shoppingListId} = route?.params || {};
  const devices = useCameraDevices();
  const device = useMemo(
    () => devices.find(d => d.position === 'back'),
    [devices],
  );

  // **NEW** permission hook
  const {hasPermission, requestPermission} = useCameraPermission();

  // barcode state/hooks
  const hasNavigatedRef = useRef(false);
  const {setScannedBarcode, setScanning, resetScanner, isScanning} =
    useBarcodeScanner();

  // local UI state
  const [isActive, setIsActive] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);

  // 1) On mount, ask for camera permission if we don't have it yet
  useEffect(() => {
    if (!hasPermission) {
      requestPermission().catch(err => {
        console.error('requestPermission error', err);
        Alert.alert('Permission Error', 'Could not request camera permission.');
      });
    }
  }, [hasPermission, requestPermission]);

  // 2) When screen focuses *and* permission granted, turn scanner on;
  //    when unfocused, turn it off.
  useFocusEffect(
    useCallback(() => {
      if (!hasPermission) {
        // we’ll show the “grant permission” UI instead
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
    }, [hasPermission, setScanning]),
  );

  // 3) Set up the VisionCamera code‐scanner callback
  const codeScanner = useCodeScanner({
    codeTypes: [
      'qr',
      'ean-13',
      'ean-8',
      'code-128',
      'code-39',
      'code-93',
      'codabar',
      'upc-a',
      'upc-e',
      'pdf-417',
      'data-matrix',
    ],
    onCodeScanned: codes => {
      if (!isActive || hasNavigatedRef.current || !codes.length) return;

      const {value, type} = codes[0];
      if (value) {
        hasNavigatedRef.current = true;
        setHasScanned(true);
        setScannedBarcode(value);
        setScanning(false);

        if (Platform.OS === 'ios') {
          const {HapticFeedback} = require('react-native');
          HapticFeedback?.impact?.(HapticFeedback.ImpactFeedbackStyle.Medium);
        }

        navigateWithinStack('SearchResults', {
          barcode: value,
          format: type,
          source,
          pantryId,
          shoppingListId,
        });
      }
    },
  });

  const toggleFlash = () => setFlashEnabled(f => !f);
  const resetScan = () => {
    setHasScanned(false);
    resetScanner();
    setScanning(true);
    hasNavigatedRef.current = false;
  };

  // --- RENDER FALLBACKS ---

  // A) No permission yet (or denied) → ask the user
  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.messageText}>
          Camera access is required to scan barcodes.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => goBack()}>
          <Text style={styles.linkButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // B) No camera hardware
  if (!device) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.messageText}>No camera device found</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => goBack()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // C) Permission granted & device ready → show scanner
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />

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
        edgeColor="#62B1F6"
        backgroundColor="rgba(0, 0, 0, 0.6)"
        showAnimatedLine={isScanning && !hasScanned}
        lineAnimationDuration={2000}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => goBack()}>
          <Text style={styles.headerButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Barcode</Text>
        <TouchableOpacity style={styles.headerButton} onPress={toggleFlash}>
          <Text style={styles.headerButtonText}>
            {flashEnabled ? '🔦' : '💡'}
          </Text>
        </TouchableOpacity>
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
          <TouchableOpacity style={styles.button} onPress={resetScan}>
            <Text style={styles.buttonText}>Scan Another</Text>
          </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: 'black'},
  camera: {flex: 1},
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
    paddingHorizontal: 20,
  },
  messageText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#62B1F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {color: 'white', fontSize: 16, fontWeight: '600'},
  linkButton: {paddingHorizontal: 24, paddingVertical: 12},
  linkButtonText: {
    color: '#62B1F6',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {color: 'white', fontSize: 18, fontWeight: 'bold'},
  headerTitle: {color: 'white', fontSize: 18, fontWeight: '600'},
  instructionsContainer: {
    position: 'absolute',
    top: screenHeight * 0.25,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 1,
  },
  instructionsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subInstructionsText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 1,
  },
  scanIndicator: {alignItems: 'center'},
  scanDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  scanDotActive: {backgroundColor: '#62B1F6'},
  scanStatusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});
