import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { StorageLocationIcon } from '#components/atoms/StorageLocationIcon';
import { commonStyles } from '#/styles/commonStyles';
import { Badge } from '#components/base/Badge';
import { Text } from '#components/atoms/Text';

const TEMPERATURE_LABELS: Record<string, string> = {
  REFRIGERATED: 'Refrigerated',
  FROZEN: 'Frozen',
  AMBIENT: 'Ambient',
};

interface StorageLocationCardProps {
  location: any;
  isDefault: boolean;
  onPress?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

export const StorageLocationCard: React.FC<StorageLocationCardProps> = ({
  location,
  isDefault,
  onPress,
  onEdit,
  onDelete,
  onSetDefault,
}) => {
  const { theme } = useUnistyles();

  const formatType = (type: string): string => {
    return type
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const hasColor = !!location.color;
  const temperatureLabel = location.temperature
    ? TEMPERATURE_LABELS[location.temperature]
    : null;
  const hasCapacity = location.capacity != null && location.capacity > 0;

  return (
    <View style={[commonStyles.card, commonStyles.shadow, styles.card]}>
      <View style={styles.cardContent}>
        {hasColor ? (
          <View
            style={[styles.colorStrip, { backgroundColor: location.color }]}
          />
        ) : null}
        <View style={styles.cardBody}>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [
              styles.cardHeader,
              pressed && onPress && { opacity: theme.opacity.pressed },
            ]}
            disabled={!onPress}
          >
            <View style={styles.headerRow}>
              <StorageLocationIcon type={location.type} size={20} />
              <View style={styles.info}>
                <View style={commonStyles.rowSpaceBetween}>
                  <Text style={commonStyles.title}>{location.name}</Text>
                  <View style={styles.badges}>
                    {!!isDefault && <Badge variant="primary">Default</Badge>}
                    {!!temperatureLabel && (
                      <Badge variant="primary">{temperatureLabel}</Badge>
                    )}
                  </View>
                </View>
                <Text style={[commonStyles.caption, styles.subtitle]}>
                  {!location.parentLocation && (
                    <Text>{formatType(location.type)} • </Text>
                  )}
                  {location.currentItemCount}{' '}
                  {location.currentItemCount === 1 ? 'item' : 'items'}
                  {hasCapacity ? (
                    <Text>
                      {' '}
                      / {location.capacity} {location.capacityUnit || 'units'}
                    </Text>
                  ) : null}
                  {!!location.parentLocation?.name && (
                    <Text tone="secondary" style={styles.parentInfo}>
                      {' '}
                      • Inside {location.parentLocation.name}
                    </Text>
                  )}
                </Text>
                {!!location.description && (
                  <Text
                    size="xs"
                    tone="secondary"
                    style={styles.description}
                    numberOfLines={1}
                  >
                    {location.description}
                  </Text>
                )}
              </View>
            </View>
          </Pressable>

          <View style={[commonStyles.row, styles.actions]}>
            {!isDefault && (
              <Pressable
                style={({ pressed }) => [
                  commonStyles.row,
                  styles.actionButton,
                  pressed && { opacity: theme.opacity.pressed },
                ]}
                onPress={onSetDefault}
              >
                <Icon name="star-outline" size={18} />
                <Text size="sm" weight="medium">
                  Set Default
                </Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                commonStyles.row,
                styles.actionButton,
                pressed && { opacity: theme.opacity.pressed },
              ]}
              onPress={onEdit}
            >
              <Icon name="create-outline" size={18} />
              <Text size="sm" weight="medium">
                Edit
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                commonStyles.row,
                styles.deleteActionButton,
                pressed && { opacity: theme.opacity.pressed },
              ]}
              onPress={onDelete}
            >
              <Icon name="trash-outline" size={18} color={theme.colors.error} />
              <Text size="sm" weight="medium" tone="error">
                Delete
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    marginBottom: theme.spacing.md,
    padding: 0,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
  },
  colorStrip: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: theme.spacing.md,
  },
  cardHeader: {
    paddingBottom: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  icon: {
    marginRight: theme.spacing.sm,
  },
  info: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
  },
  description: {
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
  },
  parentInfo: {
    fontStyle: 'italic',
  },
  actions: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  deleteActionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
}));
