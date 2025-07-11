import React, {useEffect} from 'react';
import {View, Text, Image} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import Loader from '../components/atoms/Loader';
import {useStore} from '../store';

const SplashScreen = () => {
  const {styles, theme} = useStyles(stylesheet);
  const isLoading = useStore(store => store.isLoading);
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
      <View style={styles.imageWrapper}>
        <Image
          source={require('../assets/images/logo.png')}
          resizeMode="contain"
          style={styles.image}
        />
      </View>

      <View style={styles.loaderWrapper}>
        <Loader />
        <Text style={styles.text}>Loading...</Text>
      </View>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  imageWrapper: {
    flex: 1, // fill the screen
    justifyContent: 'center', // center vertically
    alignItems: 'center', // center horizontally
  },
  image: {
    width: 300,
    height: 300,
  },
  loaderWrapper: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  text: {
    fontSize: theme.fonts.size.xl,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.md,
  },
}));

export default SplashScreen;
