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
   * State-driven presentation: when provided, the sheet auto-presents on
   * `true` and dismisses on `false` via `useStandardBottomSheet`'s guarded
   * `visible` path (which also adds navigation focus-awareness). This is the
   * preferred convention. Mutually exclusive with `sheetRef` — pass one or the
   * other, not both (a caller-supplied `sheetRef` overrides the hook's internal
   * ref, which the auto present/dismiss effect drives).
   */
  visible?: boolean;
  /** Manual presentation: parent drives this sheet imperatively via the ref. */
  sheetRef?: Ref<BottomSheetModalRef>;
  /** Whether to wrap content in scrollable view (default: true). Set to false when children contain FlatList/SectionList */
  scrollable?: boolean;
  /** Optional element to render on the right side of the header */
  headerRight?: ReactNode;
  /** Called when the sheet is dismissed (after close animation completes) */
  onDismiss?: () => void;
  /** Called when the sheet snap point changes (-1 = closed, 0+ = open) */
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
    // Forward through the hook so it composes the backdrop claim with the
    // caller's onChange. Setting `onChange` directly on `<BottomSheetModal>`
    // below would overwrite the hook's composed handler and silently break
    // the dim layer (the claim/release path never fires).
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
