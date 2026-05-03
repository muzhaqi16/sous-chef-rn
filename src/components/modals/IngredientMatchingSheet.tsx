import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import {
  BottomSheetModal,
  BottomSheetView,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';

import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { IngredientMatchRow } from '#features/recipes/components/IngredientMatchRow';
import {
  IngredientMatchingProvider,
  useIngredientMatchingActions,
} from '#components/modals/IngredientMatchingContext';
import type {
  EditableMatch,
  MatchSummary,
} from '#features/recipes/hooks/useRecipeIngredientMatching';
import { Text } from '#components/atoms/Text';

const keyExtractor = (item: EditableMatch) => item.match.ingredient.id;

const IngredientMatchRenderItemComponent = ({
  item,
  index,
}: {
  item: EditableMatch;
  index: number;
}) => {
  const { onUpdate } = useIngredientMatchingActions();
  return (
    <IngredientMatchRow
      editableMatch={item}
      index={index}
      onUpdate={onUpdate}
    />
  );
};

const IngredientMatchRenderItem = IngredientMatchRenderItemComponent;

const renderItem = ({ item, index }: ListRenderItemInfo<EditableMatch>) => (
  <IngredientMatchRenderItem item={item} index={index} />
);

const getMatchItemType = (item: EditableMatch) =>
  item.match.matchedPantryItem ? 'matched' : 'unmatched';

interface IngredientMatchingSheetProps {
  visible: boolean;
  editableMatches: EditableMatch[];
  matchSummary: MatchSummary;
  onUpdate: (
    index: number,
    updates: Partial<Pick<EditableMatch, 'adjustedQuantity' | 'isIncluded'>>,
  ) => void;
  onConfirm: () => void;
  onSkip: () => void;
  onClose: () => void;
  confirmLoading: boolean;
}

export const IngredientMatchingSheet: React.FC<
  IngredientMatchingSheetProps
> = ({
  visible,
  editableMatches,
  matchSummary,
  onUpdate,
  onConfirm,
  onSkip,
  onClose,
  confirmLoading,
}) => {
  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      visible,
      onDismiss: onClose,
      snapPoints: ['80%'],
    });
  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetView style={[styles.container, contentContainerStyle]}>
        <BottomSheetHeader
          title="Review Ingredients"
          onCancel={onClose}
          onConfirm={onConfirm}
          confirmLabel={confirmLoading ? 'Deducting...' : 'Confirm & Deduct'}
          confirmDisabled={confirmLoading || matchSummary.included === 0}
          confirmColor="success"
        />

        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <SummaryPill
            label="Available"
            count={matchSummary.available}
            color={theme.colors.success}
          />
          <SummaryPill
            label="Partial"
            count={matchSummary.partial}
            color={theme.colors.warning}
          />
          <SummaryPill
            label="Missing"
            count={matchSummary.missing}
            color={theme.colors.error}
          />
          <Text size="xs" tone="secondary" style={styles.includedText}>
            {matchSummary.included}/{matchSummary.total} included
          </Text>
        </View>

        {/* Ingredient list */}
        <IngredientMatchingProvider onUpdate={onUpdate}>
          <FlashList
            renderScrollComponent={BottomSheetScrollable}
            data={editableMatches}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemType={getMatchItemType}
            {...FLASHLIST_DEFAULTS.bottomSheet}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </IngredientMatchingProvider>

        {/* Bottom actions */}
        <View style={styles.bottomActions}>
          <Pressable
            onPress={onSkip}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text size="base" weight="medium" tone="secondary">
              Skip Review
            </Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            disabled={confirmLoading || matchSummary.included === 0}
            style={({ pressed }) => [
              styles.confirmButton,
              pressed && styles.buttonPressed,
              (confirmLoading || matchSummary.included === 0) &&
                styles.buttonDisabled,
            ]}
          >
            {confirmLoading ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text size="base" weight="semibold" style={styles.confirmText}>
                Confirm & Deduct ({matchSummary.included})
              </Text>
            )}
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const SummaryPill: React.FC<{
  label: string;
  count: number;
  color: string;
}> = ({ label, count, color }) => (
  <View style={[styles.pill, { backgroundColor: color + '20' }]}>
    <Text size="xs" weight="semibold" style={{ color }}>
      {count} {label}
    </Text>
  </View>
);

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radii.sm,
  },
  includedText: {
    marginLeft: 'auto',
  },
  list: {
    flex: 1,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  skipButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  confirmButton: {
    flex: 2,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: theme.colors.white,
  },
  buttonPressed: {
    opacity: theme.opacity.pressed,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}));
