import React from 'react';
import { View } from 'react-native';
import { useFragment } from '@apollo/client/react';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import {
  PantryItemBatchFragmentDoc,
  type PantryItemBatchFragment,
} from '#features/pantry/graphql/pantryFragments.generated';
import { formatQuantity } from '#/utils/formatQuantity';
import { Text } from '#components/atoms/Text';

interface BatchListItemProps {
  batch: PantryItemBatchFragment;
  unitSymbol?: string;
  onOpen?: (batchId: string) => void;
  onWaste?: (batchId: string) => void;
}

const getExpiryText = (expiresAt: string | null | undefined) => {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffDays = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) return { text: 'Expired', isExpired: true };
  if (diffDays === 0) return { text: 'Expires today', isExpired: false };
  if (diffDays === 1) return { text: '1 day left', isExpired: false };
  return { text: `${diffDays} days left`, isExpired: false };
};

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const BatchListItemComponent: React.FC<BatchListItemProps> = ({
  batch: batchSource,
  unitSymbol,
  onOpen,
  onWaste,
}) => {
  // Per-entity cache subscription: re-renders only when this batch's
  // PantryItemBatchFragment fields change (e.g., status, isOpened, quantity
  // updated by openBatch / wasteBatch mutations). Falls back to the source
  // prop on cache miss so the list cell never blanks out.
  const fragmentResult = useFragment({
    fragment: PantryItemBatchFragmentDoc,
    fragmentName: 'PantryItemBatchFragment',
    from: batchSource,
  });
  const batch = fragmentResult.complete ? fragmentResult.data : batchSource;

  const expiryInfo = getExpiryText(batch.expiresAt);
  const isActive = batch.status === BatchStatus.Active;

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <View style={styles.titleRow}>
          <Text size="base" weight="medium">
            Batch #{batch.batchNumber}
          </Text>
          {!!batch.isOpened && (
            <View style={styles.openedBadge}>
              <Text size="xs" weight="medium" tone="accent">
                Opened
              </Text>
            </View>
          )}
          {batch.status === BatchStatus.Wasted && (
            <View style={styles.wastedBadge}>
              <Text size="xs" weight="medium" tone="error">
                Wasted
              </Text>
            </View>
          )}
          {batch.status === BatchStatus.Depleted && (
            <View style={styles.depletedBadge}>
              <Text size="xs" weight="medium" tone="tertiary">
                Depleted
              </Text>
            </View>
          )}
        </View>

        <Text size="sm" style={styles.quantityText}>
          {formatQuantity(batch.quantity)} {unitSymbol ?? ''}
        </Text>

        {expiryInfo ? (
          <View style={styles.expiryRow}>
            <Text size="sm" tone={expiryInfo.isExpired ? 'error' : 'warning'}>
              {expiryInfo.text}
            </Text>
            {!!batch.expiresAtIsManual && (
              <Icon name="lock-closed-outline" size={12} tone="textTertiary" />
            )}
          </View>
        ) : null}

        {batch.store?.name ? (
          <Text size="xs" tone="tertiary" style={styles.metaText}>
            {batch.store.name}
          </Text>
        ) : null}

        {batch.costPerUnit != null && batch.costPerUnit > 0 ? (
          <Text size="xs" tone="tertiary" style={styles.metaText}>
            ${batch.costPerUnit.toFixed(2)}/unit
          </Text>
        ) : null}

        {batch.notes ? (
          <Text
            size="xs"
            tone="tertiary"
            style={styles.metaText}
            numberOfLines={1}
          >
            {batch.notes}
          </Text>
        ) : null}

        {batch.depletedAt ? (
          <Text size="xs" tone="tertiary" style={styles.metaText}>
            Depleted {formatDate(batch.depletedAt)}
          </Text>
        ) : null}
      </View>
      {!!isActive && (
        <View style={styles.actions}>
          {!batch.isOpened && !!onOpen && (
            <AppPressable
              onPress={() => onOpen(batch.id)}
              style={styles.actionButton}
              hitSlop={8}
            >
              <Icon name="open-outline" size={18} tone="primary" />
            </AppPressable>
          )}
          {!!onWaste && (
            <AppPressable
              onPress={() => onWaste(batch.id)}
              style={styles.actionButton}
              hitSlop={8}
            >
              <Icon name="trash-outline" size={18} tone="error" />
            </AppPressable>
          )}
        </View>
      )}
    </View>
  );
};

// React Compiler memoizes JSX at the parent call site (BatchSection renders
// BatchListItem via .map(), not FlashList), so React.memo + custom
// comparator is redundant — and custom comparators are explicitly banned per
// CLAUDE.md / project memory.
export const BatchListItem = BatchListItemComponent;

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  leftSection: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: 2,
  },
  openedBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.full,
  },
  wastedBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    backgroundColor: theme.colors.errorLight ?? theme.colors.error + '20',
    borderRadius: theme.radii.full,
  },
  depletedBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.full,
  },
  quantityText: {
    marginTop: 2,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: 2,
  },
  metaText: {
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
    paddingTop: 2,
  },
  actionButton: {
    padding: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
