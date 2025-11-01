import React, { useRef, ReactNode, Ref } from 'react';
import { Keyboard } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Title } from '../atoms';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface BottomSheetActionProps {
  children: ReactNode;
  sheetTitle?: string;
  snapPoints?: string[] | number[];
  /** Optional ref so parent can control this sheet */
  sheetRef?: Ref<BottomSheetModal>;
}

export const BottomSheetAction: React.FC<BottomSheetActionProps> = ({
  children,
  sheetTitle,
  snapPoints = ['25%', '50%', '90%'],
  sheetRef,
}) => {
  const { theme } = useUnistyles();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const insets = useSafeAreaInsets();

  return (
    <BottomSheetModal
      ref={sheetRef || bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      keyboardBehavior="fillParent"
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={() => {
        // Optionally handle dismiss actions here
        Keyboard.dismiss();
      }}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: 'gray' }}
      backdropComponent={props => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close" // sheet closes when backdrop is pressed
        />
      )}
    >
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {sheetTitle && <Title style={styles.sheetTitle}>{sheetTitle}</Title>}
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(() => ({
  scrollView: {
    flex: 1, // Allow ScrollView to fill the bottom sheet
  },
  contentContainer: {
    padding: 16, // Padding for content, no flex to allow scrolling
  },
  sheetTitle: {},
}));
