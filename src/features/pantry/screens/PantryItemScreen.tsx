import React from 'react';

import type { StaticScreenProps } from '@react-navigation/native';
import { PantryItemForm } from '#features/pantry/components/form/PantryItemForm';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';

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
  const { goBack } = useAppNavigation();

  return <PantryItemForm itemId={route.params.itemId} onSuccess={goBack} />;
};
