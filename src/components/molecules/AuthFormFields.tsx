import React from 'react';
import {View, Text} from 'react-native';
import {Controller, Control, FieldErrorsImpl} from 'react-hook-form';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

import {FormValues} from '../organisms/LoginForm';
import EmailInput from './EmailInput';
import PasswordInput from './PasswordInput';

interface AuthFormFieldsProps {
  control: Control<FormValues>;
  errors: FieldErrorsImpl<FormValues>;
}

const AuthFormFields: React.FC<AuthFormFieldsProps> = ({control, errors}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      {/* Email Field */}
      <Controller
        control={control}
        name="email"
        render={({field: {onChange, onBlur, value}}) => (
          <EmailInput
            label="Email address"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
          />
        )}
      />
      {errors.email && (
        <Text style={styles.inputError}>{errors.email.message}</Text>
      )}

      {/* Password Field */}
      <Controller
        control={control}
        name="password"
        render={({field: {onChange, onBlur, value}}) => (
          <PasswordInput
            label="Password"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
          />
        )}
      />
      {errors.password && (
        <Text style={styles.inputError}>{errors.password.message}</Text>
      )}
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    width: '100%',
  },
  inputError: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: '#F82E08',
  },
}));

export default AuthFormFields;
