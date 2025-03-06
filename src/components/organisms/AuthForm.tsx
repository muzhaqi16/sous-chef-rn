// src/components/organisms/AuthForm.tsx
import React, {useState} from 'react';
import {View, Button, Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';

import {useStore} from '../../store/useStore';
import AuthFormFields from '../molecules/AuthFormFields';
import {getAuthValidationSchema} from '../../utils/validation';

export interface FormValues {
  username?: string | null; // or just string
  email: string;
  password: string;
}

interface AuthFormProps {
  isLogin: boolean;
}

const AuthForm: React.FC<AuthFormProps> = ({isLogin}) => {
  const {styles} = useStyles(stylesheet);
  const [error, setError] = useState<string | null>(null);
  const {login, signup} = useStore();

  // Generate validation schema from a utility function
  const validationSchema = getAuthValidationSchema(isLogin);

  // Set up react-hook-form
  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<FormValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      username: '',
      email: 'artanmuzhaqi@gmail.com',
      password: 'Test123!',
    },
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setError(null);
    if (isLogin) {
      // Logging in
      console.log('Logging in with', data);
      const resp = await login(data.email, data.password);
      if (resp) {
        setError(resp);
      }
    } else {
      // Signing up
      console.log('Signing up with', data);
      const resp = await signup(data.username ?? '', data.email, data.password);
      if (resp) {
        setError(resp);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLogin ? 'Login' : 'Sign Up'}</Text>

      {/* All the form fields */}
      <AuthFormFields isLogin={isLogin} control={control} errors={errors} />

      {/* Server / Store Error */}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* Submit Button */}
      <Button
        title={isLogin ? 'Login' : 'Sign Up'}
        onPress={handleSubmit(onSubmit)}
      />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    width: '100%',
    padding: 20,
    borderRadius: 8,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.typography,
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
}));

export default AuthForm;
