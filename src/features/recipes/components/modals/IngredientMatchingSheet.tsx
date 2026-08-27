import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import {
  Pressable,
  WhiteActivityIndicator,
} from '#components/atoms/themedComponents';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import {
  BottomSheetView,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';

import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { IngredientMatchRow } from '#features/recipes/components/IngredientMatchRow';
import {
  IngredientMatchingProvider,
  useIngredientMatchingActions,
} from '#features/recipes/components/modals/IngredientMatchingContext';
import type {
  EditableMatch,
  MatchSummary,
} from '#features/recipes/hooks/useRecipeIngredientMatching';
import { Text } from '#components/atoms/Text';

const keyExtractor = (item: EditableMatch) => item.ingredient.id;

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
  const { t } = useTranslation();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['80%'],
  });
  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetView style={[styles.container, contentContainerStyle]}>
        <BottomSheetHeader
          title={t('ingredientMatching.reviewIngredients')}
          onCancel={onClose}
          onConfirm={onConfirm}
          confirmLabel={
            confirmLoading
              ? t('ingredientMatching.deducting')
              : t('ingredientMatching.confirmAndDeduct')
          }
          confirmDisabled={confirmLoading || matchSummary.included === 0}
          confirmColor="success"
        />

        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <SummaryPill
            label={t('labels.available')}
            count={matchSummary.available}
            tone="success"
          />
          <SummaryPill
            label={t('labels.partial')}
            count={matchSummary.partial}
            tone="warning"
          />
          <SummaryPill
            label={t('labels.missing')}
            count={matchSummary.missing}
            tone="error"
          />
          <Text size="xs" tone="secondary" style={styles.includedText}>
            {t('ingredientMatching.includedCount', {
              n: matchSummary.included,
              m: matchSummary.total,
            })}
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
              {t('ingredientMatching.skipReview')}
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
              <WhiteActivityIndicator size="small" />
            ) : (
              <Text size="base" weight="semibold" style={styles.confirmText}>
                {t('ingredientMatching.confirmAndDeductCount', {
                  count: matchSummary.included,
                })}
              </Text>
            )}
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

type SummaryTone = 'success' | 'warning' | 'error';

const SummaryPill: React.FC<{
  label: string;
  count: number;
  tone: SummaryTone;
}> = ({ label, count, tone }) => {
  styles.useVariants({ tone });
  return (
    <View style={styles.pill}>
      <Text size="xs" weight="semibold" style={styles.pillText}>
        {count} {label}
      </Text>
    </View>
  );
};

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
    borderCurve: 'continuous',
    variants: {
      tone: {
        success: { backgroundColor: theme.colors.success + '20' },
        warning: { backgroundColor: theme.colors.warning + '20' },
        error: { backgroundColor: theme.colors.error + '20' },
      },
    },
  },
  pillText: {
    variants: {
      tone: {
        success: { color: theme.colors.success },
        warning: { color: theme.colors.warning },
        error: { color: theme.colors.error },
      },
    },
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
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  confirmButton: {
    flex: 2,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
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
