import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { StaticScreenProps } from '@react-navigation/native';
import { PantryItemForm } from '#features/pantry/components/form/PantryItemForm';

type PantryItemScreenParams = {
  itemId: string;
};

/**
 * Edits one pantry item.
 *
 * `itemId` is required — this route registers with `linking: null` and both
 * callers of `toPantryItem` pass one. Adding goes through `AddToPantrySheet`
 * → `AddDetailsSheet`.
 */
export const PantryItemScreen: React.FC<
  StaticScreenProps<PantryItemScreenParams>
> = ({ route }) => {
  const { goBack } = useNavigation();

  return <PantryItemForm itemId={route.params.itemId} onSuccess={goBack} />;
};
