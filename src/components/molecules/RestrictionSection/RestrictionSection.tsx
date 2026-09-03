import React from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';

export interface RestrictionSectionItem {
  id: string;
  label: string;
}

export interface RestrictionSectionProps {
  title: string;
  existingItems: RestrictionSectionItem[];
  onRemove: (id: string) => void;
  onAddPress: () => void;
  emptyMessage?: string;
}

export const RestrictionSection: React.FC<RestrictionSectionProps> = ({
  title,
  existingItems,
  onRemove,
  onAddPress,
  emptyMessage = 'None added yet',
}) => {
  return (
    <View style={styles.container}>
      {/* Header with title and add button */}
      <View style={styles.header}>
        <Text style={commonStyles.subtitle}>{title}</Text>
        <AppPressable onPress={onAddPress} style={styles.addButton}>
          <Icon name="add" size={18} tone="primary" />
        </AppPressable>
      </View>
      {/* Chip grid showing existing items */}
      {existingItems.length > 0 ? (
        <View style={styles.chipContainer}>
          {existingItems.map(item => (
            <View key={item.id} style={styles.chipWrapper}>
              <View style={styles.displayChip}>
                <Text style={styles.displayChipText}>{item.label}</Text>
              </View>
              <AppPressable
                style={styles.removeButton}
                onPress={() => onRemove(item.id)}
              >
                <Icon name="close-circle-outline" size={18} tone="error" />
              </AppPressable>
            </View>
          ))}
        </View>
      ) : (
        <Text size="sm" tone="secondary">
          {emptyMessage}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  chipWrapper: {
    position: 'relative',
    margin: theme.spacing.xs,
  },
  displayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii['2xl'],
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.thin,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.chipSelectedBackground,
  },
  displayChipText: {
    fontSize: theme.typography.fontSize.sm + 1,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.chipSelectedText,
  },
  removeButton: {
    position: 'absolute',
    top: -theme.spacing.xs,
    right: -theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.full,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
