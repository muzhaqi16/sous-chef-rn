import {
  CommonActions,
  type NavigationAction,
  type RootParamList,
} from '@react-navigation/native';

type RootRoute = keyof RootParamList;

/**
 * A root route with its params, checked against the root navigator
 * `RootNavigator.tsx` registers. A root navigate never reaches into an
 * unfocused child stack, so a route only a nested stack holds does not compile.
 */
export type RootNavigateArgs<Name extends RootRoute = RootRoute> =
  Name extends unknown
    ? undefined extends RootParamList[Name]
      ? [
          screen: Name,
          params?: RootParamList[Name],
          options?: { pop?: boolean },
        ]
      : [screen: Name, params: RootParamList[Name], options?: { pop?: boolean }]
    : never;

/** A navigate action to a root route, its params checked against the route. */
export const rootNavigate = (...args: RootNavigateArgs): NavigationAction => {
  const [name, params, options] = args;
  // A screen declared without params types them `unknown`, and passes none.
  return CommonActions.navigate(
    name,
    typeof params === 'object' && params !== null ? params : undefined,
    options,
  );
};
