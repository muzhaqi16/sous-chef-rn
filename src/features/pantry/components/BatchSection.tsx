import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import type { PantryItemBatchFragment } from '#features/pantry/graphql/pantryFragments.generated';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import { BatchListItem } from './BatchListItem';
import { useOpenPantryItemBatch } from '#features/pantry/hooks/mutations/useOpenPantryItemBatch';
import { useWastePantryItemBatch } from '#features/pantry/hooks/mutations/useWastePantryItemBatch';
import { Text } from '#components/atoms/Text';
import { CollapsibleSection } from '#components/molecules/CollapsibleSection';

/** Active batches shown inline; the rest live on the history screen. */
const INLINE_LIMIT = 3;

interface BatchSectionProps {
  /**
   * Unmasked from the parent, which queries with NO status filter — active AND
   * inactive are already present. `BatchListItem` runs its own `useFragment`
   * for reactive per-row updates.
   */
  batches: ReadonlyArray<PantryItemBatchFragment>;
  unitSymbol?: string;
  netWeightUnitSymbol?: string;
  /** Every batch, including pages this screen did not fetch. */
  totalCount?: number;
  onViewAll: () => void;
  onCorrectSize?: (batchId: string) => void;
}

export const BatchSection: React.FC<BatchSectionProps> = ({
  batches,
  unitSymbol,
  netWeightUnitSymbol,
  totalCount,
  onViewAll,
  onCorrectSize,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  const { openBatch } = useOpenPantryItemBatch();
  const { wasteBatch } = useWastePantryItemBatch();

  // Sort active batches by expiration (FIFO order) — earliest first
  const activeBatches = batches
    .filter(b => b.status === BatchStatus.Active)
    .sort((a, b) => {
      if (!a.expiresOn && !b.expiresOn) return a.batchNumber - b.batchNumber;
      if (!a.expiresOn) return 1;
      if (!b.expiresOn) return -1;
      return a.expiresOn.localeCompare(b.expiresOn);
    });

  const activeBatchCount = activeBatches.length;
  // Depleted and wasted batches are never pruned, so the full set is unbounded
  // — it belongs on its own paginated screen, not inline.
  const shownBatches = activeBatches.slice(0, INLINE_LIMIT);
  const allBatchCount = totalCount ?? batches.length;
  const hasMore = allBatchCount > shownBatches.length;

  const handleOpen = (batchId: string) => {
    void openBatch(batchId);
  };

  const handleWaste = (batchId: string) => {
    void wasteBatch(batchId);
  };

  return (
    <View>
      <CollapsibleSection
        title={t('pantryItemDetail.batch.sectionHeader', {
          count: activeBatchCount,
        })}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      >
        <View style={styles.content}>
          {shownBatches.map(batch => (
            <BatchListItem
              key={batch.id}
              batch={batch}
              unitSymbol={unitSymbol}
              netWeightUnitSymbol={netWeightUnitSymbol}
              onOpen={handleOpen}
              onWaste={handleWaste}
              onCorrectSize={onCorrectSize}
            />
          ))}

          {!!hasMore && (
            <AppPressable onPress={onViewAll} style={styles.showAllButton}>
              <Text role="label" tone="accent">
                {t('batchSection.viewAll', { count: allBatchCount })}
              </Text>
            </AppPressable>
          )}
        </View>
      </CollapsibleSection>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  showAllButton: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
}));
