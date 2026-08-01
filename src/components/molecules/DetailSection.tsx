import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

interface DetailSectionProps {
  title?: string;
  /** Drops horizontal padding for children that manage their own insets. */
  flush?: boolean;
  /** No card chrome (background/shadow/padding) — keeps only the section rhythm. */
  transparent?: boolean;
  /** Expands to fill available vertical space (useful for empty states). */
  fill?: boolean;
  /** Layout overrides (e.g. a template canceling the horizontal margin). */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Elevated card grouping a block of detail content with an optional heading.
 * The single detail-card primitive: item detail screens compose it directly
 * and DetailTemplate renders its sections through it, so radius/shadow/
 * heading/rhythm stay identical everywhere. Vertical rhythm (marginBottom)
 * is built in.
 */
export const DetailSection: React.FC<DetailSectionProps> = ({
  title,
  flush,
  transparent,
  fill,
  style,
  children,
}) => (
  <View
    style={[
      transparent
        ? styles.sectionTransparent
        : flush
        ? styles.sectionFlush
        : styles.section,
      !!fill && styles.fill,
      style,
    ]}
  >
    {!!title && <Text style={styles.sectionHeading}>{title}</Text>}
    {children}
  </View>
);

const styles = StyleSheet.create(theme => ({
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    marginHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.card,
  },
  sectionFlush: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    marginHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    ...theme.shadows.card,
  },
  sectionTransparent: {
    marginHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  fill: {
    flex: 1,
  },
  sectionHeading: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
}));
