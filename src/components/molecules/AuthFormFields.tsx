import React from 'react';
import {View, Text} from 'react-native';
import {Controller, Control, FieldErrorsImpl} from 'react-hook-form';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

import Input from '../atoms/Input';
import {FormValues} from '../organisms/AuthForm';

interface AuthFormFieldsProps {
  isLogin: boolean;
  control: Control<FormValues>;
  errors: FieldErrorsImpl<FormValues>;
}

const AuthFormFields: React.FC<AuthFormFieldsProps> = ({
  isLogin,
  control,
  errors,
}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      {/* Conditionally render Username only for Sign-Up */}
      {!isLogin && (
        <>
          <Controller
            control={control}
            name="username"
            render={({field: {onChange, onBlur, value}}) => (
              <Input
                placeholder="Username"
                value={value || ''}
                onBlur={onBlur}
                onChangeText={onChange}
              />
            )}
          />
          {errors.username && (
            <Text style={styles.error}>{errors.username.message}</Text>
          )}
        </>
      )}

      {/* Email Field */}
      <Controller
        control={control}
        name="email"
        render={({field: {onChange, onBlur, value}}) => (
          <Input
            placeholder="Email"
            keyboardType="email-address"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
          />
        )}
      />
      {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}

      {/* Password Field */}
      <Controller
        control={control}
        name="password"
        render={({field: {onChange, onBlur, value}}) => (
          <Input
            placeholder="Password"
            secureTextEntry
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
          />
        )}
      />
      {errors.password && (
        <Text style={styles.error}>{errors.password.message}</Text>
      )}
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    width: '100%',
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
}));

export default AuthFormFields;
