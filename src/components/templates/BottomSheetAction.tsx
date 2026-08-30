import React, { ReactNode, Ref } from 'react';
import { Keyboard, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  BottomSheetModal,
  type BottomSheetModalRef,
} from '#hooks/useStandardBottomSheet';
import { Title } from '../atoms/Title';
import { StyleSheet } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';

interface BottomSheetActionProps {
  children: ReactNode;
  sheetTitle?: string;
  snapPoints?: string[] | number[];
  /**
   * The preferred convention: auto-presents on `true` through
   * `useStandardBottomSheet`'s guarded, focus-aware `visible` path. Mutually
   * exclusive with `sheetRef`, which would override the ref this effect drives.
   */
  visible?: boolean;
  /** Manual presentation: parent drives this sheet imperatively via the ref. */
  sheetRef?: Ref<BottomSheetModalRef>;
  /** Default true; false when children contain their own FlatList/SectionList. */
  scrollable?: boolean;
  headerRight?: ReactNode;
  onDismiss?: () => void;
  /** Snap point changed; -1 is closed. */
  onChange?: (index: number) => void;
}

export const BottomSheetAction: React.FC<BottomSheetActionProps> = ({
  children,
  sheetTitle,
  snapPoints = ['25%', '50%', '90%'],
  visible,
  sheetRef,
  scrollable = true,
  headerRight,
  onDismiss: onDismissProp,
  onChange: onChangeProp,
}) => {
  const {
    ref: bottomSheetModalRef,
    modalProps,
    insets,
  } = useStandardBottomSheet({
    visible,
    onDismiss: () => {
      Keyboard.dismiss();
      onDismissProp?.();
    },
    snapPoints,
    keyboardBehavior: 'fillParent',
    // Forwarded through the hook so it composes the backdrop claim with the
    // caller's handler; setting `onChange` on the modal directly overwrites the
    // composed one and silently kills the dim layer.
    onChange: onChangeProp ? index => onChangeProp(index) : undefined,
  });

  const content = (
    <>
      {!!(sheetTitle || headerRight) && (
        <View style={styles.headerRow}>
          {sheetTitle ? (
            <Title style={styles.sheetTitle}>{sheetTitle}</Title>
          ) : null}
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
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </BottomSheetScrollView>
      ) : (
        <>
          {!!(sheetTitle || headerRight) && (
            <View style={styles.nonScrollableHeader}>
              {sheetTitle ? (
                <Title style={styles.sheetTitle}>{sheetTitle}</Title>
              ) : null}
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
