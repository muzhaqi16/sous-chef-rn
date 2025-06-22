import {client} from '../../apollo/client';
import {LOGIN_MUTATION, SIGNUP_MUTATION} from '../graphql/mutations/auth';

import {User} from '../graphql/generated';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export async function loginApi(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const {data} = await client.mutate({
    mutation: LOGIN_MUTATION,
    variables: {email, password},
  });
  return data.login;
}

export async function signupApi(
  username: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const {data} = await client.mutate({
    mutation: SIGNUP_MUTATION,
    variables: {username, email, password},
  });
  return data.signup;
}
