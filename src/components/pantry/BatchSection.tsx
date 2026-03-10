import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import {
  BatchStatus,
  type PantryItemBatchFragment,
  useGetPantryItemBatchesLazyQuery,
} from '#generated';
import { BatchListItem } from './BatchListItem';
import { useOpenPantryItemBatch } from '#hooks/pantry/mutations/useOpenPantryItemBatch';
import { useWastePantryItemBatch } from '#hooks/pantry/mutations/useWastePantryItemBatch';

interface BatchSectionProps {
  batches: PantryItemBatchFragment[];
  pantryItemId: string;
  unitSymbol?: string;
}

export const BatchSection: React.FC<BatchSectionProps> = ({
  batches,
  pantryItemId,
  unitSymbol,
}) => {
  const { theme } = useUnistyles();
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const { openBatch } = useOpenPantryItemBatch();
  const { wasteBatch } = useWastePantryItemBatch();

  // Lazy query for loading all batches (including depleted/wasted)
  const [fetchAllBatches, { data: allBatchesData }] =
    useGetPantryItemBatchesLazyQuery({
      fetchPolicy: 'cache-and-network',
    });

  // Sort active batches by expiration (FIFO order) — earliest first
  const activeBatches = batches
    .filter(b => b.status === BatchStatus.Active)
    .sort((a, b) => {
      if (!a.expiresAt && !b.expiresAt) return a.batchNumber - b.batchNumber;
      if (!a.expiresAt) return 1;
      if (!b.expiresAt) return -1;
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    });

  const inactiveBatches = showAll
    ? (allBatchesData?.pantryItemBatches ?? batches).filter(
        b => b.status !== BatchStatus.Active,
      )
    : [];

  const activeBatchCount = activeBatches.length;
  const hasInactiveBatches = batches.some(b => b.status !== BatchStatus.Active);

  const handleToggleShowAll = () => {
    if (!showAll) {
      // Fetch all batches including depleted/wasted
      fetchAllBatches({ variables: { pantryItemId } });
    }
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
      <Pressable
        style={({ pressed }) => [
          styles.sectionHeader,
          pressed && styles.pressed,
        ]}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.sectionTitle}>
          Batches ({activeBatchCount} active)
        </Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.textSecondary}
        />
      </Pressable>

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
            <Pressable
              onPress={handleToggleShowAll}
              style={({ pressed }) => [
                styles.showAllButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.showAllText}>
                {showAll ? 'Hide inactive batches' : 'Show all batches'}
              </Text>
            </Pressable>
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
  sectionTitle: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  showAllButton: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  showAllText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
