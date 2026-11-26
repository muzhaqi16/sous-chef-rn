import React from 'react';
import { SheetHeader } from '#components/templates/SheetHeader';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import { Sheet } from '#components/templates/Sheet';
import { StyleSheet } from 'react-native-unistyles';

import { FLASHLIST_DEFAULTS } from '#constants/flashListDefaults';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { Button } from '#components/molecules/Button';
import { Badge } from '#components/atoms/Badge';
import { IngredientMatchRow } from '#features/recipes/components/IngredientMatchRow';
import {
  IngredientMatchingProvider,
  MatchReadingSystemProvider,
  useIngredientMatchingActions,
  useMatchReadingSystem,
} from '#features/recipes/components/modals/IngredientMatchingContext';
import type {
  EditableMatch,
  MatchSummary,
  MatchUpdate,
} from '#features/recipes/hooks/useRecipeIngredientMatching';
import { Text } from '#components/atoms/Text';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';

const keyExtractor = (item: EditableMatch) => item.ingredient.id;

const IngredientMatchRenderItemComponent = ({
  item,
  index,
}: {
  item: EditableMatch;
  index: number;
}) => {
  const { onUpdate } = useIngredientMatchingActions();
  const readingSystem = useMatchReadingSystem();
  return (
    <IngredientMatchRow
      editableMatch={item}
      index={index}
      readingSystem={readingSystem}
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
  /** Records the cook and leaves the pantry alone: the action when nothing is included. */
  onRecordOnly: () => void;
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
  onRecordOnly,
  onClose,
  confirmLoading,
}) => {
  const { t } = useTranslation();
  const readingSystem = useReadingSystem();
  // Nothing included: the cook can still be recorded, deducting nothing.
  const recordsOnly = matchSummary.included === 0;
  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  return (
    <Sheet
      mode="list"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['80%']}
      // The choice is the pair at the foot: skip the review, or deduct.
      header={
        <SheetHeader
          title={t('ingredientMatching.reviewIngredients')}
          onClose={onClose}
        />
      }
    >
      <View style={styles.container}>
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
        <MatchReadingSystemProvider value={readingSystem}>
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
        </MatchReadingSystemProvider>

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
            onPress={recordsOnly ? onRecordOnly : onConfirm}
            loading={confirmLoading}
            style={styles.confirm}
            testID={recipesTestIDs.cookReviewConfirm}
          >
            {recordsOnly
              ? t('ingredientMatching.recordWithoutDeducting')
              : t('ingredientMatching.confirmAndDeductCount', {
                  count: matchSummary.included,
                })}
          </Button>
        </View>
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    paddingHorizontal: theme.layout.pageGutter,
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
