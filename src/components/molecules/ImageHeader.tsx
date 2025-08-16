import React from 'react';
import {View, Image} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export const ImageHeader: React.FC = () => {
  const {styles} = useStyles(stylesheet);

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

const stylesheet = createStyleSheet(theme => ({
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
