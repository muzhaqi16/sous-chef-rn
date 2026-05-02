import type { UnistylesValues } from 'react-native-unistyles';

export function defineStyles<S extends Record<string, UnistylesValues>>(
  styles: S,
): S {
  return styles;
}
