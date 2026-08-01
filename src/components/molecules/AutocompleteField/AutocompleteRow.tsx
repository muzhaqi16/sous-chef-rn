import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';

interface AutocompleteRowProps {
  icon?: string;
  iconElement?: React.ReactNode;
  image?: string | null;
  symbolText?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  trailingText?: string;
  highlighted?: boolean;
}

export const AutocompleteRow: React.FC<AutocompleteRowProps> = ({
  icon,
  iconElement,
  image,
  symbolText,
  title,
  subtitle,
  badge,
  trailingText,
  highlighted,
}) => (
  <View style={[styles.row, highlighted && styles.highlighted]}>
    {iconElement != null ? (
      <View style={styles.iconContainer}>{iconElement}</View>
    ) : icon != null ? (
      <Text size="xl" align="center" style={styles.icon}>
        {icon}
      </Text>
    ) : null}
    {image !== undefined &&
      (image ? (
        <CachedImage uri={image} style={styles.image} displaySize={44} />
      ) : (
        <View style={styles.imagePlaceholder} />
      ))}
    {symbolText != null && (
      <Text size="md" weight="semibold" tone="accent" style={styles.symbolText}>
        {symbolText}
      </Text>
    )}
    <View style={styles.content}>
      <View style={styles.titleRow}>
        <Text size="md" weight="semibold">
          {title}
        </Text>
        {!!badge && (
          <View style={styles.badge}>
            <Text size="xs" weight="semibold" tone="accent">
              {badge}
            </Text>
          </View>
        )}
      </View>
      {subtitle ? (
        <Text size="sm" tone="secondary" style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {trailingText ? (
      <Text size="sm" tone="secondary" style={styles.trailingText}>
        {trailingText}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create(theme => ({
  row: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  highlighted: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  icon: {
    width: 32,
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceVariant,
  },
  imagePlaceholder: {
    width: 44,
    height: 44,
  },
  symbolText: {
    minWidth: 40,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  subtitle: {
    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
  },
  badge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primaryLight,
  },
  trailingText: {
    fontStyle: 'italic',
  },
}));
