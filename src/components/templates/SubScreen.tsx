import React from 'react';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { Screen, type ScreenProps } from './Screen';

type WithoutHeader<T> = T extends unknown ? Omit<T, 'header'> : never;

export type SubScreenProps = WithoutHeader<ScreenProps> & {
  title?: string;
  actions?: HeaderAction[];
  /** Right-side content that is not an icon — a Save affordance, a text button. */
  rightElement?: React.ReactNode;
};

/**
 * A pushed screen: the standard header with a back control that returns to the
 * previous screen. A preset over `Screen`, so the inset, gutter and scroll rules
 * are the scaffold's; a screen whose back does something else uses `Screen`.
 */
export const SubScreen: React.FC<SubScreenProps> = ({
  title,
  actions,
  rightElement,
  ...screenProps
}) => {
  const { goBack } = useAppNavigation();

  return (
    <Screen
      {...screenProps}
      header={{ title: title ?? '', back: goBack, actions, rightElement }}
    />
  );
};
