import type React from 'react';
import { useEffect, useRef } from 'react';
import type { StaticScreenProps } from '@react-navigation/native';
import { Screen } from '#components/templates/Screen';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';

/**
 * Opened by `recipes/:recipeId`; `replace`s itself with `RecipeDetail`, so it
 * never stays in the back stack.
 */
export const RecipeLinkScreen: React.FC<
  StaticScreenProps<{ recipeId: string }>
> = ({ route }) => {
  const { replaceWithRecipeDetail } = useAppNavigation();
  const { recipeId } = route.params;

  // The hook's return is recreated when `navigation` changes; a second
  // `replace` from this already-replaced route would go unhandled.
  const routedRef = useRef(false);

  useEffect(() => {
    if (routedRef.current) return;
    routedRef.current = true;
    replaceWithRecipeDetail({ recipeId });
  }, [recipeId, replaceWithRecipeDetail]);

  return <Screen scroll="none">{null}</Screen>;
};
