import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { StaticScreenProps } from '@react-navigation/native';
import { PantryItemForm } from '#features/pantry/components/form/PantryItemForm';

type PantryItemScreenParams = {
  itemId: string;
};

/**
 * Edits one pantry item; `itemId` is always present (both callers of
 * `toPantryItem` pass one). Adding goes through `AddToPantrySheet`.
 */
export const PantryItemScreen: React.FC<
  StaticScreenProps<PantryItemScreenParams>
> = ({ route }) => {
  const { goBack } = useNavigation();

  return <PantryItemForm itemId={route.params.itemId} onSuccess={goBack} />;
};
