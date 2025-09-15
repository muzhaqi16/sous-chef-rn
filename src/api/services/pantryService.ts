import {client} from '../../apollo/client';
import {GET_USER_PANTRY_ITEMS} from '../graphql/queries/pantry';

import {PantryItem} from '../graphql/generated';

export const getPantryItemsApi = async () => {
  try {
    const {data} = await client.query({
      query: GET_USER_PANTRY_ITEMS,
      variables: {},
    });
    return data.pantryItems as PantryItem[];
  } catch (error) {
    console.error('Error fetching pantry items:', error);
    throw error;
  }
};
