import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { OfflineStatusPill } from '#components/molecules/OfflineStatusPill';
import { BarActions, type BarAction } from '#components/molecules/BarActions';
import { Text } from '#components/atoms/Text';

interface TabScreenHeaderProps {
  label: string;
  title: string;
  actions?: BarAction[];
  onTitlePress?: () => void;
  titleAccessory?: React.ReactNode;
}

export const TabScreenHeader: React.FC<TabScreenHeaderProps> = ({
  label,
  title,
  actions,
  onTitlePress,
  titleAccessory,
}) => {
  const titleContent = (
    <View style={styles.titleRow}>
      <Text
        role="title"
        style={styles.title}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
      {!!titleAccessory && titleAccessory}
    </View>
  );

  return (
    <View style={styles.header}>
      <View style={styles.leftContent}>
        <Text role="caption" tone="secondary" style={styles.label}>
          {label}
        </Text>
        {onTitlePress ? (
          <Pressable onPress={onTitlePress} accessibilityRole="button">
            {titleContent}
          </Pressable>
        ) : (
          titleContent
        )}
      </View>

      {/* The offline pill renders null while online, so with no actions the
          group is simply empty. */}
      <BarActions
        leading={<OfflineStatusPill size={20} />}
        actions={actions}
        placement="gutter"
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  // No horizontal inset: this header renders inside its screen's list content
  // container, which owns the page gutter.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  leftContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  label: {
    marginBottom: theme.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  title: {
    flexShrink: 1,
  },
}));
