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
      variant: {
        title: {
          fontSize: theme.fonts.size['2xl'],
          fontWeight: theme.fonts.weight.bold,
          lineHeight: theme.fonts.size['2xl'] * 1.2,
        },
        subtitle: {
          fontSize: theme.fonts.size.xl,
          fontWeight: theme.fonts.weight.semibold,
        },
        heading: {
          fontSize: theme.fonts.size.lg,
          fontWeight: theme.fonts.weight.semibold,
        },
        body: {
          fontSize: theme.fonts.size.md,
          fontWeight: theme.fonts.weight.regular,
        },
        caption: {
          fontSize: theme.fonts.size.sm,
          fontWeight: theme.fonts.weight.regular,
          color: theme.colors.textSecondary,
        },
        label: {
          fontSize: theme.fonts.size.md,
          fontWeight: theme.fonts.weight.medium,
        },
        error: {
          fontSize: theme.fonts.size.sm,
          fontWeight: theme.fonts.weight.regular,
          color: theme.colors.error,
        },
      },
      size: {
        '2xs': { fontSize: theme.fonts.size['2xs'] },
        xs: { fontSize: theme.fonts.size.xs },
        sm: { fontSize: theme.fonts.size.sm },
        base: { fontSize: theme.fonts.size.base },
        md: { fontSize: theme.fonts.size.md },
        lg: { fontSize: theme.fonts.size.lg },
        xl: { fontSize: theme.fonts.size.xl },
        '2xl': { fontSize: theme.fonts.size['2xl'] },
        '3xl': { fontSize: theme.fonts.size['3xl'] },
        '4xl': { fontSize: theme.fonts.size['4xl'] },
        '5xl': { fontSize: theme.fonts.size['5xl'] },
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
