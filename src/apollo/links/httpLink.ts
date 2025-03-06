import {createHttpLink} from '@apollo/client';
import {API_URL} from '../config';

export const httpLink = createHttpLink({
  uri: `${API_URL}/graphql`,
});
