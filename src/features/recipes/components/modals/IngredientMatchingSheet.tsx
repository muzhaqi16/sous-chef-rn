import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';

import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { Button } from '#components/molecules/Button';
import { Badge } from '#components/atoms/Badge';
import { IngredientMatchRow } from '#features/recipes/components/IngredientMatchRow';
import {
  IngredientMatchingProvider,
  useIngredientMatchingActions,
} from '#features/recipes/components/modals/IngredientMatchingContext';
import type {
  EditableMatch,
  MatchSummary,
  MatchUpdate,
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

const getMatchItemType = (item: EditableMatch) => {
  if (item.stackOptions.length > 1) return 'choice';
  return item.selectedStack ? 'matched' : 'unmatched';
};

interface IngredientMatchingSheetProps {
  visible: boolean;
  editableMatches: EditableMatch[];
  matchSummary: MatchSummary;
  onUpdate: (index: number, updates: MatchUpdate) => void;
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
      {/* A plain View, NOT `BottomSheetView`: gorhom composes the caller's
        style FIRST and its own is absolutely positioned with no bottom, so the
        `flex: 1` below loses and the FlashList is never height-bounded. It also
        registers SCROLLABLE_TYPE.VIEW after the list, losing arbitration. */}
      <View style={[styles.container, contentContainerStyle]}>
        <BottomSheetHeader
          contentPadding="md"
          title={t('ingredientMatching.reviewIngredients')}
          onCancel={onClose}
          onConfirm={onConfirm}
          confirmLabel={t('ingredientMatching.confirmAndDeduct')}
          confirmDisabled={matchSummary.included === 0}
          saving={confirmLoading}
          savingLabel={t('ingredientMatching.deducting')}
        />

        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <Badge variant="success">
            {t('ingredientMatching.summaryAvailable', {
              count: matchSummary.available,
            })}
          </Badge>
          <Badge variant="warning">
            {t('ingredientMatching.summaryPartial', {
              count: matchSummary.partial,
            })}
          </Badge>
          <Badge variant="danger">
            {t('ingredientMatching.summaryMissing', {
              count: matchSummary.missing,
            })}
          </Badge>
          {matchSummary.unsure > 0 && (
            <Badge variant="warning">
              {t('ingredientMatching.summaryUnsure', {
                count: matchSummary.unsure,
              })}
            </Badge>
          )}
          <Text role="caption" tone="secondary" style={styles.includedText}>
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

        <View style={styles.bottomActions}>
          <Button
            variant="secondary"
            onPress={onSkip}
            disabled={confirmLoading}
            style={styles.skip}
          >
            {t('ingredientMatching.skipReview')}
          </Button>
          <Button
            onPress={onConfirm}
            loading={confirmLoading}
            disabled={matchSummary.included === 0}
            style={styles.confirm}
          >
            {t('ingredientMatching.confirmAndDeductCount', {
              count: matchSummary.included,
            })}
          </Button>
        </View>
      </View>
    </BottomSheetModal>
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
  skip: {
    flex: 1,
  },
  confirm: {
    flex: 2,
  },
}));
