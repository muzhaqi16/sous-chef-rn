import {createHttpLink} from '@apollo/client';

export const httpLink = createHttpLink({
  uri:  process.env.API_URL || 'http://localhost:4000/graphql',
});
