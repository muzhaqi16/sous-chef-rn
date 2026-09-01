import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import { type PantryItemBatchFragment } from '#features/pantry/graphql/pantryFragments.generated';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import { BatchListItem } from './BatchListItem';
import { useOpenPantryItemBatch } from '#features/pantry/hooks/mutations/useOpenPantryItemBatch';
import { useWastePantryItemBatch } from '#features/pantry/hooks/mutations/useWastePantryItemBatch';
import { Text } from '#components/atoms/Text';

/**
 * `batches` arrive unmasked from the parent, which queries with NO status
 * filter — active AND inactive are already present. `BatchListItem` runs its
 * own `useFragment` for reactive per-row updates.
 */
/** Active batches shown inline; the rest live on the history screen. */
const INLINE_LIMIT = 3;

interface BatchSectionProps {
  batches: ReadonlyArray<PantryItemBatchFragment>;
  unitSymbol?: string;
  /** Every batch, including pages this screen did not fetch. */
  totalCount?: number;
  onViewAll: () => void;
}

export const BatchSection: React.FC<BatchSectionProps> = ({
  batches,
  unitSymbol,
  totalCount,
  onViewAll,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  const { openBatch } = useOpenPantryItemBatch();
  const { wasteBatch } = useWastePantryItemBatch();

  // Sort active batches by expiration (FIFO order) — earliest first
  const activeBatches = batches
    .filter(b => b.status === BatchStatus.Active)
    .sort((a, b) => {
      if (!a.expiresAt && !b.expiresAt) return a.batchNumber - b.batchNumber;
      if (!a.expiresAt) return 1;
      if (!b.expiresAt) return -1;
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    });

  const activeBatchCount = activeBatches.length;
  // Depleted and wasted batches are never pruned, so the full set is unbounded
  // — it belongs on its own paginated screen, not inline.
  const shownBatches = activeBatches.slice(0, INLINE_LIMIT);
  const allBatchCount = totalCount ?? batches.length;
  const hasMore = allBatchCount > shownBatches.length;

  const handleOpen = (batchId: string) => {
    openBatch(batchId);
  };

  const handleWaste = (batchId: string) => {
    wasteBatch(batchId);
  };

  return (
    <View>
      {/* Section Header */}
      <AppPressable
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <Text size="base" weight="semibold">
          {t('pantryItemDetail.batch.sectionHeader', {
            count: activeBatchCount,
          })}
        </Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          tone="textSecondary"
        />
      </AppPressable>
      {!!expanded && (
        <View style={styles.content}>
          {shownBatches.map(batch => (
            <BatchListItem
              key={batch.id}
              batch={batch}
              unitSymbol={unitSymbol}
              onOpen={handleOpen}
              onWaste={handleWaste}
            />
          ))}

          {!!hasMore && (
            <AppPressable onPress={onViewAll} style={styles.showAllButton}>
              <Text size="sm" weight="medium" tone="accent">
                {t('batchSection.viewAll', { count: allBatchCount })}
              </Text>
            </AppPressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  showAllButton: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
