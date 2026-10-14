import type { ReactNode } from 'react';
import { ScopedTheme, useUnistyles } from 'react-native-unistyles';
import { useThemeEpoch } from '#hooks/ui/useThemeEpoch';

/**
 * For a host that mounts its children later than they were created — a sheet
 * on present, a modal on show, a section on expand. A compiled caller can hand
 * it elements cached before a theme change, and Unistyles corrects a style
 * snapshot at mount only inside a scoped theme. A `withUnistyles` or
 * `useUnistyles` reader inside one ignores every theme event, so each theme
 * commit — a switch, or new values under the same name — remounts the children.
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
