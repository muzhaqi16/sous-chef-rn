import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import type { TypeRoleName } from '#/theme/foundations/type';

export type TextRole = TypeRoleName;

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'onSurfaceVariant'
  | 'error'
  | 'accent'
  | 'success'
  | 'warning';

export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export type TextAlign = 'left' | 'center' | 'right';

export type TextLineHeight = 'tight' | 'normal' | 'relaxed' | 'loose';

export type TextSize =
  | '2xs'
  | 'xs'
  | 'sm'
  | 'base'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl';

/**
 * `role` is the typography role, which shadows RN's ARIA-style `role`; nothing
 * in the tree passes that one, and `accessibilityRole` is the spelling the 78
 * accessible elements already use.
 */
export interface TextProps extends Omit<RNTextProps, 'style' | 'role'> {
  role?: TextRole;
  tone?: TextTone;
  align?: TextAlign;
  /** Kit-only escape hatch: a size no role provides. */
  size?: TextSize;
  /** Kit-only escape hatch: a weight no role provides. */
  weight?: TextWeight;
  /** Kit-only escape hatch: leading a role does not carry. */
  lineHeight?: TextLineHeight;
  style?: StyleProp<TextStyle>;
}

/**
 * The OS text size multiplies on top of the app's own font-scale preference,
 * which is already baked into the theme's numbers. The ceiling is the remainder
 * of one documented maximum, so it is set here and nowhere else.
 */
const ScaledText = withUnistyles(RNText, theme => ({
  maxFontSizeMultiplier: theme.maxFontScaleMultiplier,
}));

export const Text: React.FC<TextProps> = ({
  role = 'body',
  tone,
  align,
  size,
  weight,
  lineHeight,
  style,
  children,
  ...rest
}) => {
  styles.useVariants({ role, tone, align, size, weight, lineHeight });
  return (
    <ScaledText {...rest} style={[styles.text, style]}>
      {children}
    </ScaledText>
  );
};

const styles = StyleSheet.create(theme => ({
  text: {
    color: theme.colors.textPrimary,
    variants: {
      // A role carries size, weight, leading and tracking together — and only
      // those: colour is `tone`'s job, so `role="error"` pairs with
      // `tone="error"`. Declared first, so a kit escape hatch below can still
      // override one of its properties.
      role: {
        display: theme.type.display,
        title: theme.type.title,
        subheading: theme.type.subheading,
        heading: theme.type.heading,
        body: theme.type.body,
        bodyStrong: theme.type.bodyStrong,
        caption: theme.type.caption,
        label: theme.type.label,
        footnote: theme.type.footnote,
        footnoteStrong: theme.type.footnoteStrong,
        error: theme.type.error,
      },
      tone: {
        primary: { color: theme.colors.textPrimary },
        secondary: { color: theme.colors.textSecondary },
        tertiary: { color: theme.colors.textTertiary },
        inverse: { color: theme.colors.textInverse },
        onSurfaceVariant: { color: theme.colors.textOnSurfaceVariant },
        error: { color: theme.colors.error },
        accent: { color: theme.colors.primary },
        success: { color: theme.colors.success },
        warning: { color: theme.colors.warning },
      },
      align: {
        left: { textAlign: 'left' },
        center: { textAlign: 'center' },
        right: { textAlign: 'right' },
      },
      // `size` sets only `fontSize`, so it keeps the role's leading and would
      // clip glyphs at `2xl` and up — hence the per-size leading there.
      size: {
        '2xs': { fontSize: theme.fonts.size['2xs'] },
        xs: { fontSize: theme.fonts.size.xs },
        sm: { fontSize: theme.fonts.size.sm },
        base: { fontSize: theme.fonts.size.base },
        md: { fontSize: theme.fonts.size.md },
        lg: { fontSize: theme.fonts.size.lg },
        xl: { fontSize: theme.fonts.size.xl },
        '2xl': {
          fontSize: theme.fonts.size['2xl'],
          lineHeight: theme.fonts.size['2xl'] * 1.25,
        },
        '3xl': {
          fontSize: theme.fonts.size['3xl'],
          lineHeight: theme.fonts.size['3xl'] * 1.2,
        },
        '4xl': {
          fontSize: theme.fonts.size['4xl'],
          lineHeight: theme.fonts.size['4xl'] * 1.2,
        },
        '5xl': {
          fontSize: theme.fonts.size['5xl'],
          lineHeight: theme.fonts.size['5xl'] * 1.2,
        },
      },
      weight: {
        regular: { fontWeight: theme.fonts.weight.regular },
        medium: { fontWeight: theme.fonts.weight.medium },
        semibold: { fontWeight: theme.fonts.weight.semibold },
        bold: { fontWeight: theme.fonts.weight.bold },
      },
      lineHeight: {
        tight: { lineHeight: theme.typography.lineHeight.tight },
        normal: { lineHeight: theme.typography.lineHeight.normal },
        relaxed: { lineHeight: theme.typography.lineHeight.relaxed },
        loose: { lineHeight: theme.typography.lineHeight.loose },
      },
    },
  },
}));

export default Text;
