import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { Badge } from '#components/base/Badge';

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
  const temperatureLabel = location.temperature ? TEMPERATURE_LABELS[location.temperature] : null;
  const hasCapacity = location.capacity != null && location.capacity > 0;

  return (
    <View style={[commonStyles.card, commonStyles.shadow, styles.card]}>
      <View style={styles.cardContent}>
        {hasColor ? (
          <View style={[styles.colorStrip, { backgroundColor: location.color }]} />
        ) : null}
        <View style={styles.cardBody}>
          <Pressable
            onPress={onPress}
            style={({pressed}) => [styles.cardHeader, pressed && onPress && styles.pressed]}
            disabled={!onPress}
          >
            <View style={commonStyles.row}>
              {location.icon ? <Text style={styles.icon}>{location.icon}</Text> : null}
              <View style={styles.info}>
                <View style={commonStyles.rowSpaceBetween}>
                  <Text style={commonStyles.title}>{location.name}</Text>
                  <View style={styles.badges}>
                    {!!isDefault && <Badge variant="primary">Default</Badge>}
                    {!!temperatureLabel && <Badge variant="primary">{temperatureLabel}</Badge>}
                  </View>
                </View>
                <Text style={[commonStyles.caption, styles.subtitle]}>
                  {!location.parentLocation && <Text>{formatType(location.type)} • </Text>}
                  {location.currentItemCount}{' '}
                  {location.currentItemCount === 1 ? 'item' : 'items'}
                  {hasCapacity ? (
                    <Text> / {location.capacity} {location.capacityUnit || 'units'}</Text>
                  ) : null}
                  {!!location.parentLocation && (
                    <Text style={styles.parentInfo}>
                      {' '}
                      • Inside {location.parentLocation.name}
                    </Text>
                  )}
                </Text>
                {!!location.description && (
                  <Text style={styles.description} numberOfLines={1}>
                    {location.description}
                  </Text>
                )}
              </View>
            </View>
          </Pressable>

          <View style={[commonStyles.row, styles.actions]}>
            {!isDefault && (
              <Pressable
                style={({pressed}) => [commonStyles.row, styles.actionButton, pressed && styles.pressed]}
                onPress={onSetDefault}
              >
                <Icon name="star-outline" size={18} />
                <Text style={styles.actionText}>Set Default</Text>
              </Pressable>
            )}
            <Pressable
              style={({pressed}) => [commonStyles.row, styles.actionButton, pressed && styles.pressed]}
              onPress={onEdit}
            >
              <Icon name="create-outline" size={18} />
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
            <Pressable
              style={({pressed}) => [commonStyles.row, styles.actionButton, styles.deleteButton, pressed && styles.pressed]}
              onPress={onDelete}
            >
              <Icon name="trash-outline" size={18} color={theme.colors.error} />
              <Text style={styles.deleteText}>Delete</Text>
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
  icon: {
    fontSize: theme.fonts.size.lg,
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
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
  },
  parentInfo: {
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
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
    gap: 4,
  },
  actionText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    fontWeight: theme.fonts.weight.medium,
  },
  deleteButton: {
    backgroundColor: theme.colors.validation.errorBg,
  },
  deleteText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.error,
    fontWeight: theme.fonts.weight.medium,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
