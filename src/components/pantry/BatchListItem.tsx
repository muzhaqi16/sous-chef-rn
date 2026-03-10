import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import { BatchStatus, type PantryItemBatchFragment } from '#generated';
import { formatQuantity } from '#/utils/formatQuantity';

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
  batch,
  unitSymbol,
  onOpen,
  onWaste,
}) => {
  const { theme } = useUnistyles();
  const expiryInfo = getExpiryText(batch.expiresAt);
  const isActive = batch.status === BatchStatus.Active;

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <View style={styles.titleRow}>
          <Text style={styles.batchLabel}>Batch #{batch.batchNumber}</Text>
          {!!batch.isOpened && (
            <View style={styles.openedBadge}>
              <Text style={styles.openedBadgeText}>Opened</Text>
            </View>
          )}
          {batch.status === BatchStatus.Wasted && (
            <View style={styles.wastedBadge}>
              <Text style={styles.wastedBadgeText}>Wasted</Text>
            </View>
          )}
          {batch.status === BatchStatus.Depleted && (
            <View style={styles.depletedBadge}>
              <Text style={styles.depletedBadgeText}>Depleted</Text>
            </View>
          )}
        </View>

        <Text style={styles.quantityText}>
          {formatQuantity(batch.quantity)} {unitSymbol ?? ''}
        </Text>

        {expiryInfo ? (
          <Text
            style={[
              styles.expiryText,
              expiryInfo.isExpired && styles.expiryTextExpired,
            ]}
          >
            {expiryInfo.text}
          </Text>
        ) : null}

        {batch.store?.name ? (
          <Text style={styles.metaText}>{batch.store.name}</Text>
        ) : null}

        {batch.costPerUnit != null && batch.costPerUnit > 0 ? (
          <Text style={styles.metaText}>
            ${batch.costPerUnit.toFixed(2)}/unit
          </Text>
        ) : null}

        {batch.notes ? (
          <Text style={styles.metaText} numberOfLines={1}>
            {batch.notes}
          </Text>
        ) : null}

        {batch.depletedAt ? (
          <Text style={styles.metaText}>
            Depleted {formatDate(batch.depletedAt)}
          </Text>
        ) : null}
      </View>

      {!!isActive && (
        <View style={styles.actions}>
          {!batch.isOpened && !!onOpen && (
            <Pressable
              onPress={() => onOpen(batch.id)}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.pressed,
              ]}
              hitSlop={8}
            >
              <Icon
                name="open-outline"
                size={18}
                color={theme.colors.primary}
              />
            </Pressable>
          )}
          {!!onWaste && (
            <Pressable
              onPress={() => onWaste(batch.id)}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.pressed,
              ]}
              hitSlop={8}
            >
              <Icon
                name="trash-outline"
                size={18}
                color={theme.colors.error}
              />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

export const BatchListItem = React.memo(
  BatchListItemComponent,
  (prev, next) =>
    prev.batch.id === next.batch.id &&
    prev.batch.status === next.batch.status &&
    prev.batch.quantity === next.batch.quantity &&
    prev.batch.isOpened === next.batch.isOpened &&
    prev.unitSymbol === next.unitSymbol,
);

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
  batchLabel: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  openedBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.full,
  },
  openedBadgeText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
  wastedBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    backgroundColor: theme.colors.errorLight ?? theme.colors.error + '20',
    borderRadius: theme.radii.full,
  },
  wastedBadgeText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.error,
    fontWeight: theme.fonts.weight.medium,
  },
  depletedBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.full,
  },
  depletedBadgeText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
    fontWeight: theme.fonts.weight.medium,
  },
  quantityText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  expiryText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.warning,
    marginTop: 2,
  },
  expiryTextExpired: {
    color: theme.colors.error,
  },
  metaText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
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
