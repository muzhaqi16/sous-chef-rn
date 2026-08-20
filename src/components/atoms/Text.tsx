import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type TextVariant =
  | 'title'
  | 'subtitle'
  | 'heading'
  | 'body'
  | 'caption'
  | 'label'
  | 'error';

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

export interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: TextVariant;
  size?: TextSize;
  tone?: TextTone;
  weight?: TextWeight;
  align?: TextAlign;
  lineHeight?: TextLineHeight;
  style?: StyleProp<TextStyle>;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  size,
  tone,
  weight,
  align,
  lineHeight,
  style,
  children,
  ...rest
}) => {
  styles.useVariants({ variant, size, tone, weight, align, lineHeight });
  return (
    <RNText {...rest} style={[styles.text, style]}>
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create(theme => ({
  text: {
    color: theme.colors.textPrimary,
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.regular,
    variants: {
      // Every variant carries a default lineHeight (leading) so text isn't
      // cramped at the platform default (~1.0–1.2×). Large display variants
      // also get slight negative tracking, which reads as more premium.
      // Leading ratios: headings ~1.2–1.3×, body/label ~1.4–1.5×.
      variant: {
        title: {
          fontSize: theme.fonts.size['2xl'],
          fontWeight: theme.fonts.weight.bold,
          lineHeight: theme.fonts.size['2xl'] * 1.2,
          letterSpacing: theme.typography.letterSpacing.tight,
        },
        subtitle: {
          fontSize: theme.fonts.size.xl,
          fontWeight: theme.fonts.weight.semibold,
          lineHeight: theme.fonts.size.xl * 1.25,
          letterSpacing: theme.typography.letterSpacing.tight,
        },
        heading: {
          fontSize: theme.fonts.size.lg,
          fontWeight: theme.fonts.weight.semibold,
          lineHeight: theme.fonts.size.lg * 1.3,
        },
        body: {
          fontSize: theme.fonts.size.md,
          fontWeight: theme.fonts.weight.regular,
          lineHeight: theme.fonts.size.md * 1.5,
        },
        caption: {
          fontSize: theme.fonts.size.sm,
          fontWeight: theme.fonts.weight.regular,
          lineHeight: theme.fonts.size.sm * 1.4,
          color: theme.colors.textSecondary,
        },
        label: {
          fontSize: theme.fonts.size.md,
          fontWeight: theme.fonts.weight.medium,
          lineHeight: theme.fonts.size.md * 1.4,
        },
        error: {
          fontSize: theme.fonts.size.sm,
          fontWeight: theme.fonts.weight.regular,
          lineHeight: theme.fonts.size.sm * 1.4,
          color: theme.colors.error,
        },
      },
      // `size` overrides only `fontSize`, so a size larger than the variant's
      // font keeps that variant's leading — and `variant` defaults to `body`,
      // whose leading is 24. At `2xl` and up the glyphs are as tall as or
      // taller than that line box and get clipped top and bottom, so those
      // sizes carry their own leading. Declared after `variant` and before
      // `lineHeight` so it wins over the former and yields to an explicit
      // `lineHeight` prop.
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
