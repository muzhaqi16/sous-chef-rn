// src/components/atoms/ErrorMessage.tsx
import React from 'react';
import {Text, View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

interface ErrorMessageProps {
  message: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({message}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: theme.colors.primary,
    fontSize: 16,
    textAlign: 'center',
    margin: 16,
  },
}));

export default ErrorMessage;
