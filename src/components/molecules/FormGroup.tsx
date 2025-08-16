import React from 'react';
import {View} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';

interface FormGroupProps {
  children: React.ReactNode;
  row?: boolean;
}

export const FormGroup: React.FC<FormGroupProps> = ({
  children,
  row = false,
}) => {
  const {styles} = useStyles(formGroupStyles);

  return <View style={[styles.container, row && styles.row]}>{children}</View>;
};

const formGroupStyles = createStyleSheet(() => ({
  container: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
}));
