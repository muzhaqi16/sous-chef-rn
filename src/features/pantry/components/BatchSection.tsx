import React, { useState } from 'react';
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
 * `batches` arrive already unmasked from the parent (PantryItemDetail fetches
 * them via the GetPantryItemBatches connection query with NO status filter — so
 * active AND inactive batches are already present — and materializes each edge
 * node through `cache.readFragment`). `BatchListItem` then runs its own
 * `useFragment` for reactive per-row updates.
 */
interface BatchSectionProps {
  batches: ReadonlyArray<PantryItemBatchFragment>;
  unitSymbol?: string;
}

export const BatchSection: React.FC<BatchSectionProps> = ({
  batches,
  unitSymbol,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

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

  // The parent already fetched every batch (no status filter), so inactive
  // batches are present in `batches` — just filter them out of the prop.
  const inactiveBatches: PantryItemBatchFragment[] = showAll
    ? batches.filter(b => b.status !== BatchStatus.Active)
    : [];

  const activeBatchCount = activeBatches.length;
  const hasInactiveBatches = batches.some(b => b.status !== BatchStatus.Active);

  const handleToggleShowAll = () => {
    setShowAll(!showAll);
  };

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
          Batches ({activeBatchCount} active)
        </Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          tone="textSecondary"
        />
      </AppPressable>
      {!!expanded && (
        <View style={styles.content}>
          {activeBatches.map(batch => (
            <BatchListItem
              key={batch.id}
              batch={batch}
              unitSymbol={unitSymbol}
              onOpen={handleOpen}
              onWaste={handleWaste}
            />
          ))}

          {inactiveBatches.map(batch => (
            <BatchListItem
              key={batch.id}
              batch={batch}
              unitSymbol={unitSymbol}
            />
          ))}

          {/* Show all toggle — only when inactive batches exist */}
          {!!hasInactiveBatches && (
            <AppPressable
              onPress={handleToggleShowAll}
              style={styles.showAllButton}
            >
              <Text size="sm" weight="medium" tone="accent">
                {showAll ? 'Hide inactive batches' : 'Show all batches'}
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
