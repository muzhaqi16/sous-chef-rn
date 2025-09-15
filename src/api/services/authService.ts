import {client} from '../../apollo/client';
import {LOGIN_MUTATION, SIGNUP_MUTATION} from '../graphql/mutations/auth';

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
