import {createHttpLink} from '@apollo/client';
import Config from 'react-native-config';

export const httpLink = createHttpLink({
  uri: `${Config.API_URL}/graphql`,
});
