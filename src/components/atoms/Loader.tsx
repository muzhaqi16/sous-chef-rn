import React from 'react';
import {ActivityIndicator, View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

interface LoaderProps {
  size?: 'small' | 'large';
  color?: string;
}

const Loader: React.FC<LoaderProps> = ({size = 'small', color = '#000'}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <View style={styles.loaderContainer}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));

export default Loader;
