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

export const addPantryItemApi = async (item: PantryItem) => {
  try {
    const {data} = await client.mutate({
      mutation: GET_USER_PANTRY_ITEMS,
      variables: {item},
    });
    return data.addPantryItem as PantryItem;
  } catch (error) {
    console.error('Error adding pantry item:', error);
    throw error;
  }
};

export const updatePantryItemApi = async (item: PantryItem) => {
  try {
    const {data} = await client.mutate({
      mutation: GET_USER_PANTRY_ITEMS,
      variables: {item},
    });
    return data.updatePantryItem as PantryItem;
  } catch (error) {
    console.error('Error updating pantry item:', error);
    throw error;
  }
};

export const deletePantryItemApi = async (id: string) => {
  try {
    const {data} = await client.mutate({
      mutation: GET_USER_PANTRY_ITEMS,
      variables: {id},
    });
    return data.deletePantryItem as PantryItem;
  } catch (error) {
    console.error('Error deleting pantry item:', error);
    throw error;
  }
};
