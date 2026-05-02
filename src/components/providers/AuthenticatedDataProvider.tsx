import React from 'react';
import { useDefaultHome } from '#hooks/home/useDefaultHome';

interface AuthenticatedDataProviderProps {
  userId: string;
}

/**
 * AuthenticatedDataProvider - Initializes home data for authenticated users
 *
 * This component runs useDefaultHome() ONCE when the user is authenticated,
 * populating the Zustand store with selectedHomeId and selectedPantryId.
 *
 * Why this exists:
 * - Prevents GetHomes/GetDefaultHome from firing on every tab switch
 * - Centralizes home initialization at app level (not screen level)
 * - Follows the same pattern as AuthenticatedSubscriptions
 *
 * @param userId - The authenticated user's ID (required)
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
