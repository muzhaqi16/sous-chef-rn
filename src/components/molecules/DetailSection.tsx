import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

interface DetailSectionProps {
  title?: string;
  /** Drops horizontal padding for children that manage their own insets. */
  flush?: boolean;
  /** Vertical spacing (marginTop or marginBottom) supplied by the caller. */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** Elevated card grouping a block of detail content with an optional heading. */
export const DetailSection: React.FC<DetailSectionProps> = ({
  title,
  flush,
  style,
  children,
}) => (
  <View style={[flush ? styles.sectionFlush : styles.section, style]}>
    {!!title && <Text style={styles.sectionHeading}>{title}</Text>}
    {children}
  </View>
);

const styles = StyleSheet.create(theme => ({
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    marginHorizontal: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.card,
  },
  sectionFlush: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    marginHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    ...theme.shadows.card,
  },
  sectionHeading: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
}));
