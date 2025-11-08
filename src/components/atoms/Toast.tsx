import React, {useState, useRef, ReactNode} from 'react';
import {Text, Platform, ToastAndroid} from 'react-native';
import Animated, {SlideInDown, SlideOutUp} from 'react-native-reanimated';
import {StyleSheet} from 'react-native-unistyles';
import {ToastContext} from '../../hooks/useToast';

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
  const [opts, setOpts] = useState<ToastOptions>({
    message: '',
    duration: ToastAndroid.SHORT,
    type: 'default',
  });
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Background colors per type for iOS fallback
  const backgroundColors: Record<ToastType, string> = {
    default: '#333',
    success: '#4CAF50',
    error: '#F44336',
    info: '#2196F3',
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {visible && Platform.OS === 'ios' && (
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutUp.duration(200)}
          style={[
            styles.toastContainer,
            {
              backgroundColor: backgroundColors[opts.type || 'default'],
            },
          ]}>
          <Text style={styles.toastText}>{opts.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create(_theme => ({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'black',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
}));
