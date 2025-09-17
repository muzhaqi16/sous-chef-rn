/**
 * Token Refresh Indicator Component
 *
 * Provides visual feedback during token refresh process
 * to inform users that authentication is being renewed.
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTokenRefreshAwareUI } from '#hooks/auth/useTokenRefreshUI';

interface TokenRefreshIndicatorProps {
  position?: 'top' | 'bottom' | 'overlay';
  showMessage?: boolean;
  style?: any;
}

export const TokenRefreshIndicator: React.FC<TokenRefreshIndicatorProps> = ({
  position = 'top',
  showMessage = true,
  style,
}) => {
  const {
    shouldShowLoadingSpinner,
    getRefreshStatusMessage,
    queuedOperationsCount,
    refreshDuration,
  } = useTokenRefreshAwareUI();

  if (!shouldShowLoadingSpinner) {
    return null;
  }

  const message = getRefreshStatusMessage();

  return (
    <View style={[styles.container, styles[position], style]}>
      <View style={styles.content}>
        <ActivityIndicator size="small" color="#007AFF" />
        {showMessage && message && (
          <Text style={styles.message}>{message}</Text>
        )}
        {__DEV__ && refreshDuration && refreshDuration > 1000 && (
          <Text style={styles.debugInfo}>
            {Math.round(refreshDuration / 1000)}s
          </Text>
        )}
      </View>
    </View>
  );
};

/**
 * Simple banner version for quick integration
 */
export const TokenRefreshBanner: React.FC = () => {
  return (
    <TokenRefreshIndicator
      position="top"
      showMessage={true}
      style={styles.banner}
    />
  );
};

/**
 * Overlay version that covers the entire screen
 */
export const TokenRefreshOverlay: React.FC = () => {
  const { shouldShowLoadingSpinner, shouldDisableUserActions } = useTokenRefreshAwareUI();

  if (!shouldShowLoadingSpinner || !shouldDisableUserActions) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayContent}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.overlayMessage}>
          Refreshing authentication...
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F8FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  debugInfo: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  banner: {
    backgroundColor: '#FFF3CD',
    borderBottomColor: '#FFEAA7',
  },
  overlayContent: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  overlayMessage: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
});