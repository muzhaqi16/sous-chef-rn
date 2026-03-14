import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import BottomSheet, { BottomSheetProps } from '@gorhom/bottom-sheet';
import { CollapseBackdrop } from '#components/atoms/CollapseBackdrop';

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
>(({ children, snapPoints = ['75%'], ...props }, ref) => {
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Expose imperative methods to control the bottom sheet.
  useImperativeHandle(ref, () => ({
    expand: () => bottomSheetRef.current?.expand(),
    close: () => bottomSheetRef.current?.close(),
  }));

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={1} // Initially closed.
      snapPoints={snapPoints}
      backdropComponent={CollapseBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      {...props}
    >
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
