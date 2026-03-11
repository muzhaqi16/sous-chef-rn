import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';

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
      <Text style={styles.icon}>{icon}</Text>
    ) : null}
    {image !== undefined &&
      (image ? (
        <CachedImage
          uri={image}
          style={styles.image}
          displaySize={44}
        />
      ) : (
        <View style={styles.imagePlaceholder} />
      ))}
    {symbolText != null && <Text style={styles.symbolText}>{symbolText}</Text>}
    <View style={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {!!badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {trailingText ? <Text style={styles.trailingText}>{trailingText}</Text> : null}
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
    fontSize: theme.typography.fontSize.xl,
    width: 32,
    textAlign: 'center',
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
    backgroundColor: theme.colors.surfaceVariant,
  },
  imagePlaceholder: {
    width: 44,
    height: 44,
  },
  symbolText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
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
  title: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
  },
  badge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.primaryLight,
  },
  badgeText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  trailingText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
}));
