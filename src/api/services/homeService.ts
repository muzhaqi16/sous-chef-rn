import {client} from '../../apollo/client';
import {SYNC_HOME} from '../graphql/mutations/home';

export const syncHomeMutation = async (home: {
  id: string;
  name: string;
  ownerId: string;
  defaultPantryId: string;
}) => {
  const result = await client.mutate({
    mutation: SYNC_HOME,
    variables: {home},
  });

  return result.data?.syncHome === true;
};
