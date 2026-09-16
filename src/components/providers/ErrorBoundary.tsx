import type { ReactNode } from 'react';
import React, { Component, useContext } from 'react';
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
// precisely when something upstream has already thrown, so it takes no hook
// subscriptions it doesn't need. i18n is initialised with bundled resources in
// `index.js` before App loads, so the keys resolve here too.
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
// the boundary may have replaced SafeAreaProvider.
// So read insets via SafeAreaInsetsContext (null-safe; useSafeAreaInsets() throws
// without a provider).
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
          role="subheading"
          align="center"
          tone="danger"
          style={styles.title}
        >
          {tGlobal('errors.boundary.title')}
        </Text>
        <Text
          role="body"
          align="center"
          lineHeight="relaxed"
          tone="secondary"
          style={styles.message}
        >
          {__DEV__ ? error.message : tGlobal('errors.codes.unexpected')}
        </Text>
        {!!context && !!__DEV__ && (
          <Text
            role="caption"
            align="center"
            tone="tertiary"
            style={styles.context}
          >
            {tGlobal('errors.boundary.contextPrefix')}
            {context}
          </Text>
        )}
        <AppPressable style={styles.retryButton} onPress={retry}>
          <Text role="bodyStrong" style={styles.retryButtonText}>
            {tGlobal('auth.tryAgain')}
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

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
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

  override render() {
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
    marginBottom: theme.spacing.base,
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
    paddingVertical: theme.spacing.base,
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
