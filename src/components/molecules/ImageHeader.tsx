import React from 'react';
import {View, Image} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

export const ImageHeader: React.FC = () => {
  return (
    <View style={styles.header}>
      <Image
        alt="App Logo"
        resizeMode="contain"
        style={styles.headerImg}
        source={{uri: 'https://assets.withfra.me/SignIn.2.png'}}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  /** Header */
  header: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerImg: {
    width: 80,
    height: 80,
    alignSelf: 'center',
  },
}));
