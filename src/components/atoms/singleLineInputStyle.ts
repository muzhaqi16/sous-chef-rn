import type { TextStyle } from 'react-native';
import type { Theme } from '#/theme/themes';

/** Native text metrics center single-line inputs; paragraph lineHeight does not. */
export const singleLineInputStyle = (theme: Theme) =>
  ({
    height: theme.sizes.input.md,
    fontSize: theme.type.body.fontSize,
    fontWeight: theme.type.body.fontWeight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  } satisfies TextStyle);
