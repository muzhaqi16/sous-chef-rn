import { HttpLink } from '@apollo/client';
import Config from 'react-native-config';
import { Environment } from '#/utils/environment';

export const httpLink = new HttpLink({
  // Use Config.API_URL from .env if set, otherwise use environment-specific default
  uri: Config.API_URL || Environment.getApiConfig().baseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});
