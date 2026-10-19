import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NavigationIntents, ScreenHooks } from '#platform/ports';
import { useAppNavigation } from './useAppNavigation';

/** The core's intents over `useAppNavigation`, for the screen it runs in. */
function useAppNavigationIntents(): NavigationIntents {
  const navigation = useAppNavigation();
  return {
    goBack: navigation.goBack,
    toAuth: navigation.toAuth,
    toVerifyEmail: navigation.toVerifyEmail,
    toJoinHomeByCode: navigation.toJoinHomeByCode,
    toJoinByShareCode: navigation.toJoinByShareCode,
    toRecipeDetail: navigation.toRecipeDetail,
    toRecipeCreate: navigation.toRecipeCreate,
  };
}

/**
 * The screen hooks over React Navigation. Each delegates through an arrow, so
 * Metro's inline requires load the navigator at its first use.
 */
export const reactNavigationScreenHooks: ScreenHooks = {
  useNavigationIntents: () => useAppNavigationIntents(),
  useIsScreenFocused: () => useIsFocused(),
  useScreenFocusEffect: effect => useFocusEffect(effect),
};
