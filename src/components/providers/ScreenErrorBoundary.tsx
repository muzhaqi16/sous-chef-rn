import React, { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { Telemetry } from '#/services/telemetry';

/**
 * Screen-level error boundaries for critical operations
 * Prevents full app reset on mutation failures, enables graceful recovery
 */

export const RecipeDetailErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    context="RecipeDetail"
    onError={(error, _errorInfo) => {
      console.error('RecipeDetail error:', error);
      Telemetry.increment('recipe_detail_errors_total', 1);
      Telemetry.trackError(error, {
        screen: 'RecipeDetail',
        error_source: 'recipe_operations',
      });
    }}
  >
    {children}
  </ErrorBoundary>
);

export const ShoppingListErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    context="ShoppingList"
    onError={(error, _errorInfo) => {
      console.error('ShoppingList error:', error);
      Telemetry.increment('shopping_list_errors_total', 1);
      Telemetry.trackError(error, {
        screen: 'ShoppingList',
        error_source: 'shopping_list_operations',
      });
    }}
  >
    {children}
  </ErrorBoundary>
);

export const PantryErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    context="Pantry"
    onError={(error, _errorInfo) => {
      console.error('Pantry error:', error);
      Telemetry.increment('pantry_errors_total', 1);
      Telemetry.trackError(error, {
        screen: 'Pantry',
        error_source: 'pantry_operations',
      });
    }}
  >
    {children}
  </ErrorBoundary>
);

export const OnboardingErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    context="Onboarding"
    onError={(error, _errorInfo) => {
      console.error('Onboarding error:', error);
      Telemetry.increment('onboarding_errors_total', 1);
      Telemetry.trackError(error, {
        screen: 'Onboarding',
        error_source: 'onboarding_operations',
      });
    }}
  >
    {children}
  </ErrorBoundary>
);
