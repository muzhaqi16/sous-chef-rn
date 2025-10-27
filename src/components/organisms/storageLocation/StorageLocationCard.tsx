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

      <View style={[commonStyles.row, styles.actions]}>
        {!isDefault && (
          <TouchableOpacity
            style={[commonStyles.row, styles.actionButton]}
            onPress={onSetDefault}
          >
            <Icon name="star-outline" size={18} />
            <Text style={styles.actionText}>Set Default</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[commonStyles.row, styles.actionButton]}
          onPress={onEdit}
        >
          <Icon name="edit" size={18} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[commonStyles.row, styles.actionButton, styles.deleteButton]}
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
    padding: theme.spacing.sm, // Reduced from md to sm
  },
  cardHeader: {
    paddingBottom: theme.spacing.xs, // Reduced from sm to xs
  },
  icon: {
    fontSize: 28, // Reduced from 32 to 28
    marginRight: theme.spacing.sm, // Reduced from md to sm
  },
  info: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2, // Reduced from xs (4px) to 2px
  },
  parentInfo: {
    fontStyle: 'italic',
    color: theme.colors.textSecondary,
  },
  actions: {
    gap: theme.spacing.xs, // Reduced from sm to xs
    paddingTop: theme.spacing.xs, // Reduced from sm to xs
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.spacing.xs, // Reduced from sm to xs
    paddingHorizontal: theme.spacing.xs, // Reduced from sm to xs
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    gap: 4, // Fixed small gap
  },
  actionText: {
    fontSize: theme.fonts.size.xs, // Reduced from sm to xs
    color: theme.colors.textPrimary,
    fontWeight: theme.fonts.weight.medium,
  },
  deleteButton: {
    backgroundColor: theme.colors.validation.errorBg,
  },
  deleteText: {
    fontSize: theme.fonts.size.xs, // Reduced from sm to xs
    color: theme.colors.error,
    fontWeight: theme.fonts.weight.medium,
  },
}));
