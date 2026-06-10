import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

interface DetailTitleRowProps {
  title: string;
  /** Optional right-aligned slot (quantity badge, formatted subtitle, …). */
  trailing?: React.ReactNode;
  /** Max title lines; unlimited when omitted. */
  numberOfLines?: number;
  /** Drops horizontal padding for parents that pad their own content. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Item-name header row for detail screens (pantry / shopping / recipe).
 * Owns the large-title typography, including the Android descender fix: an
 * explicit, font-relative line height — an unset lineHeight on large bold
 * Text crops the glyph box, and a fixed token would stop scaling with the
 * user's font-size preference (which multiplies `fonts.size` only).
 */
export const DetailTitleRow: React.FC<DetailTitleRowProps> = ({
  title,
  trailing,
  numberOfLines,
  flush,
  style,
}) => (
  <View style={[flush ? styles.rowFlush : styles.row, style]}>
    <Text style={styles.title} numberOfLines={numberOfLines}>
      {title}
    </Text>
    {trailing}
  </View>
);

const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  rowFlush: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  title: {
    flex: 1,
    fontSize: theme.fonts.size['2xl'],
    lineHeight: Math.round(theme.fonts.size['2xl'] * 1.35),
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
}));
