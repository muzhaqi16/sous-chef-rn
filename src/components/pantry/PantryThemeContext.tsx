import { createContext, useContext } from 'react';

export interface PantryExpirationColors {
  expired: string;
  warning: string;
  normal: string;
}

const PantryThemeContext = createContext<PantryExpirationColors | null>(null);
export const PantryThemeProvider = PantryThemeContext.Provider;

export const usePantryTheme = (): PantryExpirationColors => {
  const ctx = useContext(PantryThemeContext);
  if (!ctx) throw new Error('usePantryTheme must be used within PantryThemeProvider');
  return ctx;
};
