import React, { Component, ReactNode, useContext } from 'react';
import { View } from 'react-native';
import {
  SafeAreaInsetsContext,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Telemetry } from '#/services/telemetry';
import { Text } from '#components/atoms/Text';
import { logger } from '#/utils/environment';
// Aliased, not `useTranslation`: this is the app's last-resort UI, rendered
// precisely when something upstream has already thrown. It deliberately takes
// no hook subscriptions it doesn't need, so it can still paint when app
// context is broken. Every call below passes an English default, so it renders
// readable text even if i18n never initialised. Language reactivity on a
// terminal error screen is worth nothing against that.
import { t as tGlobal } from '#/i18n';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  context?: string; // For debugging/analytics
}

// Top-level crash fallback — it can render with no providers above it, since
// the boundary may have replaced SafeAreaProvider (and i18n may be the failure).
// So read insets via SafeAreaInsetsContext (null-safe; useSafeAreaInsets() throws
// without a provider) and use t() with literal fallbacks (never throws/suspends).
const DefaultErrorFallback: React.FC<{
  error: Error;
  retry: () => void;
  context?: string;
}> = ({ error, retry, context }) => {
  const contextInsets = useContext(SafeAreaInsetsContext);
  const insets = contextInsets ??
    initialWindowMetrics?.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Text
          size="xl"
          weight="bold"
          align="center"
          tone="error"
          style={styles.title}
        >
          {tGlobal('errors.boundary.title', 'Something went wrong')}
        </Text>
        <Text
          size="md"
          align="center"
          lineHeight="relaxed"
          tone="secondary"
          style={styles.message}
        >
          {__DEV__
            ? error.message
            : tGlobal(
                'errors.codes.unexpected',
                'An unexpected error occurred',
              )}
        </Text>
        {!!context && !!__DEV__ && (
          <Text size="xs" align="center" tone="tertiary" style={styles.context}>
            {tGlobal('errors.boundary.contextPrefix', 'Context: ')}
            {context}
          </Text>
        )}
        <AppPressable style={styles.retryButton} onPress={retry}>
          <Text size="md" weight="semibold" style={styles.retryButtonText}>
            {tGlobal('auth.tryAgain', 'Try Again')}
          </Text>
        </AppPressable>
      </View>
    </View>
  );
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error for debugging
    logger.error('ErrorBoundary caught an error:', error);
    logger.error('Error details:', errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    if (!__DEV__) {
      this.reportError(error, errorInfo);
    }
  }

  private reportError = (error: Error, errorInfo: React.ErrorInfo) => {
    Telemetry.trackError(error, {
      component_stack: errorInfo.componentStack,
      error_boundary_context: this.props.context,
      is_fatal: true,
      error_source: 'react_error_boundary',
    });

    logger.debug('Error reported to telemetry:', {
      error: error.message,
      stack: error.stack,
      context: this.props.context,
      componentStack: errorInfo.componentStack,
    });
  };

  private retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          retry={this.retry}
          context={this.props.context}
        />
      );
    }

    return this.props.children;
  }
}

// Specialized error boundaries for different contexts

export const NavigationErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    context="Navigation"
    onError={error => {
      logger.error('Navigation error:', error);
      Telemetry.increment('navigation_errors_total', 1);
    }}
    fallback={(error, retry) => (
      <DefaultErrorFallback
        error={error}
        retry={retry}
        context="Navigation - The app will try to recover"
      />
    )}
  >
    {children}
  </ErrorBoundary>
);

export const AuthErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    context="Authentication"
    onError={error => {
      logger.error('Auth error:', error);
      Telemetry.increment('auth_errors_total', 1);
    }}
    fallback={(error, retry) => (
      <DefaultErrorFallback
        error={error}
        retry={retry}
        context="Authentication - Please try logging in again"
      />
    )}
  >
    {children}
  </ErrorBoundary>
);

export const AppErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    context="Application"
    onError={error => {
      logger.error('App-level error:', error);
      Telemetry.increment('app_level_errors_total', 1);
    }}
  >
    {children}
  </ErrorBoundary>
);

// Hook for programmatic error handling
export const useErrorHandler = () => {
  return (error: Error, context?: string) => {
    logger.error(`Error in ${context || 'unknown context'}:`, error);

    Telemetry.trackError(error, {
      error_handler_context: context,
      error_source: 'use_error_handler',
      is_fatal: false,
    });
  };
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  title: {
    marginBottom: theme.spacing['3'],
  },
  message: {
    marginBottom: theme.spacing.sm,
  },
  context: {
    marginBottom: theme.spacing.xl,
    fontStyle: 'italic',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
  },
  retryButtonText: {
    color: theme.colors.background,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default ErrorBoundary;
