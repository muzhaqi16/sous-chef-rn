import type { ReactNode } from 'react';
import { ScopedTheme, useUnistyles } from 'react-native-unistyles';
import { useThemeEpoch } from '#hooks/ui/useThemeEpoch';

/**
 * For a host that mounts children late (sheet, modal, expand): Unistyles fixes
 * a cached style snapshot at mount only in a scoped theme, whose `withUnistyles`
 * and `useUnistyles` readers ignore theme events, so each theme commit remounts.
 */
export const CurrentThemeScope = ({ children }: { children: ReactNode }) => {
  const { rt } = useUnistyles();
  const epoch = useThemeEpoch();
  if (!rt.themeName) return children;
  return (
    <ScopedTheme key={`${rt.themeName}:${epoch}`} name={rt.themeName}>
      {children}
    </ScopedTheme>
  );
};
