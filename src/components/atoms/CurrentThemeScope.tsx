import type { ReactNode } from 'react';
import { ScopedTheme, useUnistyles } from 'react-native-unistyles';

/**
 * For a host that mounts its children later than they were created — a sheet
 * on present, a modal on show, a section on expand. A compiled caller can hand
 * it elements cached before a theme change, and Unistyles corrects a style
 * snapshot at mount only inside a scoped theme. Keyed, so a switch between
 * themes while mounted remounts the children in the new one.
 */
export const CurrentThemeScope = ({ children }: { children: ReactNode }) => {
  const { rt } = useUnistyles();
  if (!rt.themeName) return children;
  return (
    <ScopedTheme key={rt.themeName} name={rt.themeName}>
      {children}
    </ScopedTheme>
  );
};
