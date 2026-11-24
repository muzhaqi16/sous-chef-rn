import React from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { Chip } from '#components/molecules/Chip';
import { useTranslation } from '#/i18n';

export interface RestrictionSectionItem {
  id: string;
  label: string;
}

export interface RestrictionSectionProps {
  title: string;
  existingItems: RestrictionSectionItem[];
  /** Gets the row as shown, so a confirmation can name it. */
  onRemove: (item: RestrictionSectionItem) => void;
  onAddPress: () => void;
  emptyMessage?: string;
}

export const RestrictionSection: React.FC<RestrictionSectionProps> = ({
  title,
  existingItems,
  onRemove,
  onAddPress,
  emptyMessage,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {/* Header with title and add button */}
      <View style={styles.header}>
        <Text role="bodyStrong" tone="secondary">
          {title}
        </Text>
        <AppPressable
          onPress={onAddPress}
          style={styles.addButton}
          accessibilityLabel={t('labels.addNamed', { name: title })}
        >
          <Icon name="add" size="xsPlus" tone="primary" />
        </AppPressable>
      </View>
      {/* Chip grid showing existing items */}
      {existingItems.length > 0 ? (
        <View style={styles.chipContainer}>
          {existingItems.map(item => (
            <Chip
              key={item.id}
              label={item.label}
              removable
              onPress={() => onRemove(item)}
              accessibilityLabel={t('a11y.removeNamed', { name: item.label })}
            />
          ))}
        </View>
      ) : (
        <Text role="caption" tone="secondary">
          {emptyMessage ?? t('restrictionSection.empty')}
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
}));
