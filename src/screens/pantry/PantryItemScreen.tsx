import React from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import { PantryItemForm } from '#components/forms/PantryItemForm';

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

  // Render the unified form in add or edit mode based on whether itemId is present
  return (
    <PantryItemForm
      mode={params?.itemId ? 'edit' : 'add'}
      itemId={params?.itemId}
      onSuccess={handleSuccess}
    />
  );
};
