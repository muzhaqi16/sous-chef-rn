import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils';
import { commonStyles } from '#styles';

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
  const formatType = (type: string): string => {
    return type
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <View style={[commonStyles.card, commonStyles.shadow, styles.card]}>
      <TouchableOpacity
        onPress={onPress}
        style={styles.cardHeader}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        <View style={commonStyles.row}>
          {location.icon && <Text style={styles.icon}>{location.icon}</Text>}
          <View style={styles.info}>
            <View style={commonStyles.rowSpaceBetween}>
              <Text style={commonStyles.title}>{location.name}</Text>
              {isDefault && (
                <View style={commonStyles.badge}>
                  <Text style={commonStyles.badgeText}>Default</Text>
                </View>
              )}
            </View>
            <Text style={[commonStyles.caption, styles.subtitle]}>
              {formatType(location.type)} • {location.currentItemCount}{' '}
              {location.currentItemCount === 1 ? 'item' : 'items'}
              {location.parentLocation && (
                <Text style={styles.parentInfo}>
                  {' '}
                  • Inside {location.parentLocation.name}
                </Text>
              )}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        {!isDefault && (
          <TouchableOpacity style={styles.actionButton} onPress={onSetDefault}>
            <Icon name="star-outline" size={18} />
            <Text style={styles.actionText}>Set Default</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
          <Icon name="edit" size={18} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={onDelete}
        >
          <Icon name="delete" size={18} color="#F44336" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardHeader: {
    paddingBottom: theme.spacing.sm,
  },
  icon: {
    fontSize: 32,
    marginRight: theme.spacing.md,
  },
  info: {
    flex: 1,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
  },
  parentInfo: {
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
  },
  actions: {
    ...commonStyles.row,
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    ...commonStyles.row,
    flex: 1,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    gap: theme.spacing.xs,
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
}));
