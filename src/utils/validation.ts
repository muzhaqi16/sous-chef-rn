import * as yup from 'yup';

/**
 * Generates a Yup validation schema based on whether
 * the form is used for login or signup.
 */
export const getAuthValidationSchema = (isLogin: boolean) =>
  yup.object().shape({
    username: isLogin
      ? yup.string().notRequired()
      : yup.string().required('Username is required'),
    email: yup
      .string()
      .email('Please enter a valid email address')
      .required('Email is required'),
    password: yup.string().required('Password is required'),
  });
