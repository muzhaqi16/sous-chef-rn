import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
} from 'react';
import {View} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import BottomSheet, {
  BottomSheetProps,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

// Define the methods that you want to expose from the bottom sheet.
export interface BottomSheetRef {
  expand: () => void;
  close: () => void;
}

// Extend the BottomSheetProps so our component is fully customizable.
interface ReusableBottomSheetProps extends BottomSheetProps {
  children: React.ReactNode;
}

const ReusableBottomSheet = forwardRef<
  BottomSheetRef,
  ReusableBottomSheetProps
>(({children, snapPoints = ['75%'], ...props}, ref) => {
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Expose imperative methods to control the bottom sheet.
  useImperativeHandle(ref, () => ({
    expand: () => bottomSheetRef.current?.expand(),
    close: () => bottomSheetRef.current?.close(),
  }));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={0}
        appearsOnIndex={1}
        opacity={0.5}
        enableTouchThrough={true}
        pressBehavior={'collapse'}
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={1} // Initially closed.
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      {...props}>
      <View style={styles.container}>{children}</View>
    </BottomSheet>
  );
});

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    padding: theme.spacing.md,
  },
}));

export default ReusableBottomSheet;
