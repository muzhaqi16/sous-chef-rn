import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Card } from '#components/atoms/Card';
import { SectionHeader } from '#components/atoms/SectionHeader';

interface DetailSectionProps {
  title?: string;
  /** Drops horizontal padding for children that manage their own insets. */
  flush?: boolean;
  /** No card chrome (background/shadow/padding) — keeps only the section rhythm. */
  transparent?: boolean;
  /** Expands to fill available vertical space (useful for empty states). */
  fill?: boolean;
  children: React.ReactNode;
}

/**
 * The single detail-card primitive: detail screens compose it directly and
 * DetailTemplate renders its sections through it, so radius/shadow/heading and
 * the built-in vertical rhythm stay identical everywhere. It carries no
 * horizontal inset: the page container it sits in owns the gutter.
 */
export const DetailSection: React.FC<DetailSectionProps> = ({
  title,
  flush,
  transparent,
  fill,
  children,
}) =>
  transparent ? (
    <View style={[styles.sectionTransparent, !!fill && styles.fill]}>
      {!!title && (
        <SectionHeader style={styles.sectionHeading}>{title}</SectionHeader>
      )}
      {children}
    </View>
  ) : (
    <Card
      radius="xl"
      padding="none"
      style={[
        flush ? styles.sectionFlush : styles.section,
        !!fill && styles.fill,
      ]}
    >
      {!!title && (
        <SectionHeader style={styles.sectionHeading}>{title}</SectionHeader>
      )}
      {children}
    </Card>
  );

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  sectionFlush: {
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  sectionTransparent: {
    marginBottom: theme.spacing.md,
  },
  fill: {
    flex: 1,
  },
  sectionHeading: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
}));
