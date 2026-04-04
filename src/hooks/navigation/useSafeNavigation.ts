import { useNavigation as useRNNavigation } from '@react-navigation/native';

interface GoBackCapable {
  canGoBack(): boolean;
  goBack(): void;
}

/**
 * Safe goBack: pops if possible.
 */
export function safeGoBack(navigation: GoBackCapable) {
  if (navigation.canGoBack()) {
    navigation.goBack();
  }
}

/**
 * A hook that returns the navigation instance along with
 * `canGoBack` and a safe `goBack()` wrapper.
 */
export function useSafeNavigation() {
  const navigation = useRNNavigation();
  const canGoBack = navigation.canGoBack();
  const goBack = () => safeGoBack(navigation);
  return { navigation, canGoBack, goBack };
}
