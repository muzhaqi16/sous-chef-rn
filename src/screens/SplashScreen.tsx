import React, {useEffect} from 'react';
import {View, Text, Image} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import Loader from '../components/atoms/Loader';

const SplashScreen = () => {
  const {styles, theme} = useStyles(stylesheet);
  useEffect(() => {
    // Handle loading indicator
    const loadingIndicator = setInterval(() => {
      console.log('Loading...');
    }, 1000);

    // Handle error handling
    const handleError = (error: any) => {
      console.error('Error:', error);
    };

    return () => {
      clearInterval(loadingIndicator);
    };
  }, []);
  return (
    <View style={styles.container}>
      <Image
        source={{uri: 'https://example.com/splash-screen-image.jpg'}}
        style={styles.image}
      />
      <View style={styles.loader}>
        <Loader size="large" color={theme.colors.primary} />
        <Text style={styles.text}>Loading...</Text>
      </View>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{translateX: -50}, {translateY: -50}],
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  text: {
    fontSize: theme.font.size.xl,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.padding.lg,
  },
}));

export default SplashScreen;
