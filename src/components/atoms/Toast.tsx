import React, {useState, useRef, ReactNode, useEffect} from 'react';
import {Text, Platform, ToastAndroid} from 'react-native';
import Animated, {SlideInDown, SlideOutUp} from 'react-native-reanimated';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {ToastContext} from '../../hooks/useToast';
import {toastService} from '#/services/toastService';

// Define toast types
export type ToastType = 'default' | 'success' | 'error' | 'info';
// Options for showing a toast
export interface ToastOptions {
  message: string;
  duration?: number;
  type?: ToastType;
}
export type ToastFn = (options: ToastOptions) => void;

export const ToastProvider: React.FC<{children: ReactNode}> = ({children}) => {
  const {theme} = useUnistyles();
  const [opts, setOpts] = useState<ToastOptions>({
    message: '',
    duration: ToastAndroid.SHORT,
    type: 'default',
  });
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast: ToastFn = ({
    message,
    duration = ToastAndroid.SHORT,
    type = 'default',
  }) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, duration);
    } else {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setOpts({message, duration, type});
      setVisible(true);

      // Auto-dismiss
      const timeout = duration === ToastAndroid.LONG ? 3500 : 2000;
      timeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, timeout);
    }
  };

  // Initialize toast service with bridge to existing toast provider
  useEffect(() => {
    toastService.init((message, type) => {
      showToast({message, type: type === 'warning' ? 'error' : type});
    });
  }, []);

  // Background colors per type for iOS fallback
  const backgroundColors: Record<ToastType, string> = {
    default: theme.colors.textPrimary,
    success: theme.colors.success,
    error: theme.colors.error,
    info: theme.colors.info,
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {visible && Platform.OS === 'ios' && (
        <Animated.View
          testID={`toast-${opts.type || 'default'}`}
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutUp.duration(200)}
          style={[
            styles.toastContainer,
            {
              backgroundColor: backgroundColors[opts.type || 'default'],
            },
          ]}>
          <Text style={styles.toastText} testID="toast-message">
            {opts.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create(theme => ({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    zIndex: theme.zIndex.toast,
    ...theme.shadows.md,
  },
  toastText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
  },
}));
