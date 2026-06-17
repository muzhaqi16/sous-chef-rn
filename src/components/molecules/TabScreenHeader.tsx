import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { OfflineStatusPill } from '#components/atoms/OfflineStatusPill';
import { Text } from '#components/atoms/Text';

interface TabScreenHeaderProps {
  label: string;
  title: string;
  headerRight?: React.ReactNode;
  onTitlePress?: () => void;
  titleAccessory?: React.ReactNode;
  /**
   * Render the built-in offline pill in the action group. Default `true`.
   * Set `false` when the screen renders its own action cluster outside this
   * header and places `<OfflineStatusPill />` there itself (e.g. MealPlanMain),
   * so the pill aligns with the real actions instead of being orphaned.
   */
  offlinePill?: boolean;
}

export const TabScreenHeader: React.FC<TabScreenHeaderProps> = ({
  label,
  title,
  headerRight,
  onTitlePress,
  titleAccessory,
  offlinePill = true,
}) => {
  const titleContent = (
    <View style={styles.titleRow}>
      <Text
        variant="title"
        maxFontSizeMultiplier={1.5}
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
        <Text
          size="sm"
          tone="secondary"
          maxFontSizeMultiplier={1.5}
          style={styles.label}
        >
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

      {/* Render the action group whenever it has content. The built-in offline
          pill (suppressed via `offlinePill={false}`) renders null while online,
          so when it's the only child the group is simply empty. */}
      {offlinePill || !!headerRight ? (
        <View style={styles.headerActions}>
          {offlinePill ? <OfflineStatusPill size={20} /> : null}
          {headerRight}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: theme.spacing.md,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
}));
