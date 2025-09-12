import React, {useState, useRef, ReactNode} from 'react';
import {Text, Platform, ToastAndroid, Animated} from 'react-native';
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
  const opacity = useRef(new Animated.Value(0)).current;

  const showToast: ToastFn = ({
    message,
    duration = ToastAndroid.SHORT,
    type = 'default',
  }) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, duration);
    } else {
      setOpts({message, duration, type});
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        const timeout = duration === ToastAndroid.LONG ? 3500 : 2000;
        setTimeout(() => {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setVisible(false));
        }, timeout);
      });
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
          style={[
            styles.toastContainer,
            {
              opacity,
              backgroundColor: backgroundColors[opts.type || 'default'],
            },
          ]}>
          <Text style={styles.toastText}>{opts.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create(theme => ({
  toastContainer: {
    position: 'absolute',
    bottom: 80,
    left: 40,
    right: 40,
    backgroundColor: 'black',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 1000,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
  },
}));
