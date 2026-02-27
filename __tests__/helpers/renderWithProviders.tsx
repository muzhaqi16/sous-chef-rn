import React, { ReactElement } from 'react';
import { render, renderHook, RenderOptions, RenderHookOptions } from '@testing-library/react-native';
import { MockedProvider, MockedProviderProps } from '@apollo/client/testing/react';

export interface ProviderOptions {
  apolloProps?: Omit<MockedProviderProps, 'children'>;
}

function AllProviders({ children, apolloProps }: ProviderOptions & { children: React.ReactNode }) {
  return (
    <MockedProvider {...apolloProps}>
      {children}
    </MockedProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: ProviderOptions & Omit<RenderOptions, 'wrapper'>,
) {
  const { apolloProps, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: (props) => (
      <AllProviders apolloProps={apolloProps} {...props} />
    ),
    ...renderOptions,
  });
}

export function renderHookWithProviders<Result, Props>(
  callback: (props: Props) => Result,
  options?: ProviderOptions & Omit<RenderHookOptions<Props>, 'wrapper'>,
) {
  const { apolloProps, ...hookOptions } = options || {};
  return renderHook(callback, {
    wrapper: (props) => <AllProviders apolloProps={apolloProps} {...props} />,
    ...hookOptions,
  });
}
