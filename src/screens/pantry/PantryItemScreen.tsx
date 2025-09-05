import React from 'react';
import {useRoute} from '@react-navigation/native';
import {PantryItemForm} from '#components/pages/PantryItemForm';

type PantryItemScreenParams = {
  itemId?: string;
};

export const PantryItemScreen: React.FC = () => {
  const route = useRoute();
  const params = route.params as PantryItemScreenParams | undefined;
  
  // Determine mode based on whether itemId is present
  const mode = params?.itemId ? 'edit' : 'add';
  
  return (
    <PantryItemForm 
      mode={mode} 
      itemId={params?.itemId}
    />
  );
};