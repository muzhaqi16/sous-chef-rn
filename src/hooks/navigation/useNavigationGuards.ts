import { useCallback } from 'react';
import { useStore } from '#store';

interface NavigationGuardResult {
  canNavigate: boolean;
  redirectTo?: string;
  reason?: string;
}

export const useNavigationGuards = () => {
  const { user } = useStore();

  // Define protected routes that require authentication
  const protectedRoutes = new Set([
    'HomeStack',
    'OnBoardingStack',
    'HomeManagementStack',
    'BarcodeStack',
    'NotificationStack',
    'ProfilePhotoUpload',
    'ImageCrop',
  ]);

  // Define routes that require email verification
  const verificationRequiredRoutes = new Set([
    'HomeStack',
    'OnBoardingStack',
    'HomeManagementStack',
    'BarcodeStack',
    'NotificationStack',
  ]);

  // Define routes that require completed onboarding
  const onboardingRequiredRoutes = new Set([
    'HomeStack',
    'HomeManagementStack',
    'BarcodeStack',
    'NotificationStack',
  ]);

  // Define routes that should not be accessible to authenticated users
  const guestOnlyRoutes = new Set(['AuthStack']);

  // Main navigation guard function
  const checkNavigationGuard = useCallback(
    (routeName: string, params?: any): NavigationGuardResult => {
      // Check if user is trying to access guest-only routes while authenticated
      if (guestOnlyRoutes.has(routeName) && user) {
        // Allow access to verification screen even if authenticated
        if (params?.screen === 'CodeVerification' && !user.emailVerified) {
          return { canNavigate: true };
        }
        
        // Redirect authenticated users away from auth screens
        if (user.onBoarded) {
          return {
            canNavigate: false,
            redirectTo: 'HomeStack',
            reason: 'User already authenticated and onboarded',
          };
        } else {
          return {
            canNavigate: false,
            redirectTo: 'OnBoardingStack',
            reason: 'User authenticated but needs onboarding',
          };
        }
      }

      // Check authentication requirement
      if (protectedRoutes.has(routeName) && !user) {
        return {
          canNavigate: false,
          redirectTo: 'AuthStack',
          reason: 'Authentication required',
        };
      }

      // Check email verification requirement
      if (verificationRequiredRoutes.has(routeName) && user && !user.emailVerified) {
        return {
          canNavigate: false,
          redirectTo: 'AuthStack',
          reason: 'Email verification required',
        };
      }

      // Check onboarding requirement
      if (onboardingRequiredRoutes.has(routeName) && user && !user.onBoarded) {
        return {
          canNavigate: false,
          redirectTo: 'OnBoardingStack',
          reason: 'Onboarding completion required',
        };
      }

      // Allow navigation
      return { canNavigate: true };
    },
    [user]
  );

  // Convenience function to check if a route is accessible
  const isRouteAccessible = useCallback(
    (routeName: string, params?: any): boolean => {
      return checkNavigationGuard(routeName, params).canNavigate;
    },
    [checkNavigationGuard]
  );

  // Get the appropriate route for current user state
  const getAuthenticatedRoute = useCallback(() => {
    if (!user) return 'AuthStack';
    if (!user.emailVerified) return 'AuthStack';
    if (!user.onBoarded) return 'OnBoardingStack';
    return 'HomeStack';
  }, [user]);

  return {
    checkNavigationGuard,
    isRouteAccessible,
    getAuthenticatedRoute,
    protectedRoutes,
    verificationRequiredRoutes,
    onboardingRequiredRoutes,
    guestOnlyRoutes,
  };
};