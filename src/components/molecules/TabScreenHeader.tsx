import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface TabScreenHeaderProps {
  label: string;
  title: string;
  headerRight?: React.ReactNode;
  onTitlePress?: () => void;
  titleAccessory?: React.ReactNode;
}

export const TabScreenHeader: React.FC<TabScreenHeaderProps> = ({
  label,
  title,
  headerRight,
  onTitlePress,
  titleAccessory,
}) => {
  const titleContent = (
    <View style={styles.titleRow}>
      <Text maxFontSizeMultiplier={1.5} style={styles.title} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>
      {!!titleAccessory && titleAccessory}
    </View>
  );

  return (
    <View style={styles.header}>
      <View style={styles.leftContent}>
        <Text maxFontSizeMultiplier={1.5} style={styles.label}>{label}</Text>
        {onTitlePress ? (
          <Pressable onPress={onTitlePress} accessibilityRole="button">
            {titleContent}
          </Pressable>
        ) : (
          titleContent
        )}
      </View>

      {!!headerRight && (
        <View style={styles.headerActions}>{headerRight}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  leftContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  label: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.regular,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  title: {
    fontSize: theme.fonts.size['2xl'],
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
}));
