import React from 'react';
import type { RefreshControlProps } from 'react-native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Screen } from './Screen';

interface ProfileScreenWrapperProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  testID?: string;
  scrollEnabled?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

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
  refreshControl,
}) => {
  const { goBack } = useAppNavigation();

  return (
    <Screen
      testID={testID}
      gutter="none"
      scroll={scrollEnabled ? 'scroll' : 'none'}
      refresh={
        refreshControl
          ? {
              refreshing: Boolean(refreshControl.props.refreshing),
              onRefresh: () => refreshControl.props.onRefresh?.(),
            }
          : undefined
      }
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
