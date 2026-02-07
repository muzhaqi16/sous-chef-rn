import React from 'react';
import { View, Text, Image } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface AutocompleteRowProps {
  icon?: string;
  image?: string | null;
  symbolText?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  trailingText?: string;
  highlighted?: boolean;
}

const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export const AutocompleteRow: React.FC<AutocompleteRowProps> = ({
  icon,
  image,
  symbolText,
  title,
  subtitle,
  badge,
  trailingText,
  highlighted,
}) => (
  <View style={[styles.row, highlighted && styles.highlighted]}>
    {icon != null && <Text style={styles.icon}>{icon}</Text>}
    {image !== undefined &&
      (image ? (
        <Image
          source={{ uri: image }}
          style={styles.image}
          defaultSource={{ uri: TRANSPARENT_PIXEL }}
        />
      ) : (
        <View style={styles.imagePlaceholder} />
      ))}
    {symbolText != null && <Text style={styles.symbolText}>{symbolText}</Text>}
    <View style={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    {trailingText && <Text style={styles.trailingText}>{trailingText}</Text>}
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
    color: theme.colors.primary,
  },
  trailingText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
}));
