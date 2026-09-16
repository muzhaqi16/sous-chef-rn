import React from 'react';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Screen, type ScreenRefresh } from './Screen';

interface ProfileScreenWrapperBaseProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  testID?: string;
}

// Pull-to-refresh needs a scroll host, so the two are declared together rather
// than left to be passed in a combination the scaffold would drop.
type ProfileScreenWrapperProps = ProfileScreenWrapperBaseProps &
  (
    | { scrollEnabled?: true; refresh?: ScreenRefresh }
    | { scrollEnabled: false; refresh?: never }
  );

/**
 * A settings sub-screen: the standard header with a back control, and a plain
 * scroll host. A preset over `Screen`, so the inset and gutter rules are the
 * scaffold's rather than this file's.
 */
export const ProfileScreenWrapper: React.FC<ProfileScreenWrapperProps> = ({
  children,
  title,
  showBackButton = true,
  testID,
  scrollEnabled = true,
  refresh,
}) => {
  const { goBack } = useAppNavigation();

  return (
    <Screen
      testID={testID}
      gutter="none"
      scroll={scrollEnabled ? 'scroll' : 'none'}
      refresh={refresh}
      header={
        showBackButton
          ? {
              variant: 'standard',
              title: title ?? '',
              back: goBack,
              centerTitle: true,
            }
          : { variant: 'none' }
      }
    >
      {children}
    </Screen>
  );
};
