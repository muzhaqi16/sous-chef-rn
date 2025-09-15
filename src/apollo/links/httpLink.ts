import {HttpLink} from '@apollo/client';
import Config from 'react-native-config';

export const httpLink = new HttpLink({
  uri: Config.API_URL || 'http://localhost:4000/graphql',
});
