import {
  NavigationProp,
  ParamListBase,
  useNavigation as useRNNavigation,
} from '@react-navigation/native';
/**
 * Safe goBack: pops if possible, otherwise navigates to `fallbackRoute`.
 */
export function safeGoBack(navigation: NavigationProp<ParamListBase>) {
  if (navigation.canGoBack()) {
    navigation.goBack();
  }
}

/**
 * A hook that returns a typed navigation instance along with
 * `canGoBack` and a `goBack()` wrapper that falls back to "Home".
 *
 * @typeParam T  the NavigationProp type for your stack
 */
export function useSafeNavigation<
  T extends NavigationProp<ParamListBase> = NavigationProp<ParamListBase>,
>(): {
  navigation: T;
  canGoBack: boolean;
  goBack: () => void;
} {
  const navigation = useRNNavigation() as unknown as T;
  const canGoBack = navigation.canGoBack();
  const goBack = () => safeGoBack(navigation as NavigationProp<ParamListBase>);
  return {navigation, canGoBack, goBack};
}
