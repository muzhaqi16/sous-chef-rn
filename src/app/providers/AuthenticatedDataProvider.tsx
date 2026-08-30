import React from 'react';
import { useDefaultHome } from '#features/home/hooks/useDefaultHome';

interface AuthenticatedDataProviderProps {
  userId: string;
}

/**
 * Runs `useDefaultHome()` ONCE per authenticated session, seeding the store's
 * `selectedHomeId` / `selectedPantryId`. At app level rather than per screen, so
 * `GetHomes` does not re-fire on every tab switch.
 */
export const AuthenticatedDataProvider: React.FC<
  AuthenticatedDataProviderProps
> = () => {
  // Initialize home defaults when user is authenticated
  // This runs ONCE on app start, not on every tab switch
  // The userId prop ensures this only runs for authenticated users
  useDefaultHome();

  // This component doesn't render anything - it just runs the hook
  return null;
};
