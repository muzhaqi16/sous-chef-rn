import React, { ReactNode, Ref } from 'react';
import { Keyboard, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Title } from '../atoms/Title';
import { StyleSheet } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';

interface BottomSheetActionProps {
  children: ReactNode;
  sheetTitle?: string;
  snapPoints?: string[] | number[];
  /** Optional ref so parent can control this sheet */
  sheetRef?: Ref<BottomSheetModal>;
  /** Whether to wrap content in scrollable view (default: true). Set to false when children contain FlatList/SectionList */
  scrollable?: boolean;
  /** Optional element to render on the right side of the header */
  headerRight?: ReactNode;
}

export const BottomSheetAction: React.FC<BottomSheetActionProps> = ({
  children,
  sheetTitle,
  snapPoints = ['25%', '50%', '90%'],
  sheetRef,
  scrollable = true,
  headerRight,
}) => {
  const { ref: bottomSheetModalRef, modalProps, insets } = useStandardBottomSheet({
    onDismiss: () => Keyboard.dismiss(),
    snapPoints,
    keyboardBehavior: 'fillParent',
  });

  const content = (
    <>
      {(sheetTitle || headerRight) && (
        <View style={styles.headerRow}>
          {sheetTitle ? <Title style={styles.sheetTitle}>{sheetTitle}</Title> : null}
          {headerRight}
        </View>
      )}
      {children}
    </>
  );

  return (
    <BottomSheetModal
      ref={sheetRef || bottomSheetModalRef}
      {...modalProps}
      index={0}
      handleIndicatorStyle={{ backgroundColor: 'gray' }}
    >
      {scrollable ? (
        <BottomSheetScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </BottomSheetScrollView>
      ) : (
        <>
          {(sheetTitle || headerRight) && (
            <View style={styles.nonScrollableHeader}>
              {sheetTitle ? <Title style={styles.sheetTitle}>{sheetTitle}</Title> : null}
              {headerRight}
            </View>
          )}
          {children}
        </>
      )}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1, // Allow ScrollView to fill the bottom sheet
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  view: {
    flex: 1,
    padding: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  nonScrollableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sheetTitle: {
    flex: 1,
  },
}));
