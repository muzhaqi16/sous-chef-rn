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
      <Text role="subheading" align="center" style={styles.icon}>
        {icon}
      </Text>
    ) : null}
    {/* No photo still takes the tile, as a placeholder, so every row's text
        starts at the same edge. */}
    {image !== undefined && (
      <CachedImage
        uri={image}
        style={styles.image}
        displaySize={44}
        accessible={false}
      />
    )}
    {symbolText != null && (
      <Text role="bodyStrong" tone="accent" style={styles.symbolText}>
        {symbolText}
      </Text>
    )}
    <View style={styles.content}>
      <View style={styles.titleRow}>
        <Text role="bodyStrong" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {!!badge && (
          <View style={styles.badge}>
            <Text role="label" tone="accent">
              {badge}
            </Text>
          </View>
        )}
      </View>
      {subtitle ? (
        <Text
          role="caption"
          tone="secondary"
          numberOfLines={1}
          style={styles.subtitle}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
    {trailingText ? (
      <Text role="caption" tone="secondary" style={styles.trailingText}>
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
  // Gives way to the badge, so a long name ends in an ellipsis on one line.
  title: {
    flexShrink: 1,
  },
  subtitle: {
    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
  },
  badge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing['2xs'],
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primaryLight,
  },
  trailingText: {
    fontStyle: 'italic',
  },
}));
