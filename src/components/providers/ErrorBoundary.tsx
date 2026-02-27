import React, { Component, ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Telemetry } from '#/services/telemetry';

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

// Error fallback component with retry functionality
const DefaultErrorFallback: React.FC<{
  error: Error;
  retry: () => void;
  context?: string;
}> = ({ error, retry, context }) => {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.error }]}>
          Something went wrong
        </Text>
        <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
          {__DEV__ ? error.message : 'An unexpected error occurred'}
        </Text>
        {!!context && !!__DEV__ && (
          <Text style={[styles.context, { color: theme.colors.textTertiary }]}>
            Context: {context}
          </Text>
        )}
        <Pressable
          style={({pressed}) => [styles.retryButton, { backgroundColor: theme.colors.primary }, pressed && styles.pressed]}
          onPress={retry}
        >
          <Text style={[styles.retryText, { color: theme.colors.background }]}>
            Try Again
          </Text>
        </Pressable>
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
      errorInfo: null};
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error};
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo});

    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error details:', errorInfo);

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
      error_source: 'react_error_boundary'});

    console.log('Error reported to telemetry:', {
      error: error.message,
      stack: error.stack,
      context: this.props.context,
      componentStack: errorInfo.componentStack});
  };

  private retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null});
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

export const NavigationErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    context="Navigation"
    onError={(error, _errorInfo) => {
      console.error('Navigation error:', error);
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

export const AuthErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    context="Authentication"
    onError={(error, _errorInfo) => {
      console.error('Auth error:', error);
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

export const AppErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    context="Application"
    onError={(error, _errorInfo) => {
      console.error('App-level error:', error);
      Telemetry.increment('app_level_errors_total', 1);
    }}
  >
    {children}
  </ErrorBoundary>
);

// Hook for programmatic error handling
export const useErrorHandler = () => {
  return (error: Error, context?: string) => {
    console.error(`Error in ${context || 'unknown context'}:`, error);

    Telemetry.trackError(error, {
      error_handler_context: context,
      error_source: 'use_error_handler',
      is_fatal: false});
  };
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg},
  content: {
    alignItems: 'center',
    maxWidth: 300},
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: theme.spacing['3'],
    textAlign: 'center'},
  message: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    lineHeight: theme.typography.lineHeight.relaxed},
  context: {
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    fontStyle: 'italic'},
  retryButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.radii.sm,
    marginTop: theme.spacing.md},
  retryText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold},
  pressed: {
    opacity: theme.opacity.pressed}}));

export default ErrorBoundary;