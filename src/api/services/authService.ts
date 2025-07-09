import {client} from '../../apollo/client';
import {
  LOGIN_MUTATION,
  FORGOT_PASSWORD_MUTATION,
  RESET_PASSWORD_MUTATION,
  SIGNUP_MUTATION,
  VERIFY_EMAIL_MUTATION,
  RESEND_VERIFICATION_EMAIL_MUTATION,
} from '../graphql/mutations/auth';

import {User, AuthPayload} from '../graphql/generated';

export async function loginApi(
  email: string,
  password: string,
): Promise<AuthPayload> {
  const {data} = await client.mutate({
    mutation: LOGIN_MUTATION,
    variables: {email, password},
  });
  return data.login;
}

export async function signupApi(
  name: string,
  email: string,
  password: string,
): Promise<AuthPayload> {
  const {data} = await client.mutate({
    mutation: SIGNUP_MUTATION,
    variables: {name, email, password},
  });
  return data.signup;
}

export async function forgotPasswordApi(email: string): Promise<void> {
  await client.mutate({
    mutation: FORGOT_PASSWORD_MUTATION,
    variables: {email},
  });
}

export async function resetPasswordApi(
  token: string,
  password: string,
): Promise<void> {
  await client.mutate({
    mutation: RESET_PASSWORD_MUTATION,
    variables: {token, password},
  });
}

export async function verifyEmailApi(code: string): Promise<User> {
  const {data} = await client.mutate({
    mutation: VERIFY_EMAIL_MUTATION,
    variables: {code},
  });
  return data.verifyEmail;
}

export async function resendVerificationEmailApi(email: string): Promise<void> {
  await client.mutate({
    mutation: RESEND_VERIFICATION_EMAIL_MUTATION,
    variables: {email},
  });
}
