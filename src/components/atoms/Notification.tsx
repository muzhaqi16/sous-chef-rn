import React, {useState, useRef, useEffect} from 'react';
import {View, Text, Animated, TouchableOpacity} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

interface NotificationBannerProps {
  title?: string;
  message: string;
  duration?: number; // in ms
  onClose?: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  title,
  message,
  duration = 5000,
  onClose,
}) => {
  const [show, setShow] = useState(true);
  const slide = useRef(new Animated.Value(-100)).current;
  const {styles} = useStyles(stylesheet);

  useEffect(() => {
    // slide down
    Animated.timing(slide, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slide, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShow(false);
        onClose?.();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <Animated.View
      style={[styles.bannerContainer, {transform: [{translateY: slide}]}]}>
      <View style={styles.bannerInner}>
        {title ? <Text style={styles.bannerTitle}>{title}</Text> : null}
        <Text style={styles.bannerMessage}>{message}</Text>
        <TouchableOpacity
          onPress={() => {
            Animated.timing(slide, {
              toValue: -100,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              setShow(false);
              onClose?.();
            });
          }}>
          <Text style={styles.bannerClose}>×</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingTop: 40, // for status bar
  },
  bannerInner: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTitle: {
    color: 'white',
    fontWeight: 'bold',
    marginRight: 8,
    flexShrink: 1,
  },
  bannerMessage: {
    color: 'white',
    flex: 1,
  },
  bannerClose: {
    color: 'white',
    fontSize: 18,
    paddingHorizontal: 8,
  },
}));
