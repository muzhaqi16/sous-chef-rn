import React from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AddPantryItemForm } from '#components/forms/AddPantryItemForm';
import { EditPantryItemForm } from '#components/forms/EditPantryItemForm';

type PantryItemScreenParams = {
  itemId?: string;
};

export const PantryItemScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as PantryItemScreenParams | undefined;

  const handleSuccess = () => {
    navigation.goBack();
  };

  // Render the appropriate form based on whether itemId is present
  if (params?.itemId) {
    return (
      <EditPantryItemForm itemId={params.itemId} onSuccess={handleSuccess} />
    );
  }

  return <AddPantryItemForm onSuccess={handleSuccess} />;
};
