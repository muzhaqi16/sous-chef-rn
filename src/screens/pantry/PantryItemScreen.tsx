import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { StaticScreenProps } from '@react-navigation/native';
import { PantryItemForm } from '#components/forms/PantryItemForm';

type PantryItemScreenParams = {
  itemId?: string;
};

export const PantryItemScreen: React.FC<StaticScreenProps<PantryItemScreenParams | undefined>> = ({ route }) => {
  const navigation = useNavigation();
  const params = route.params;

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
