import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { MockedProvider, MockedProviderProps } from '@apollo/client/testing/react';

interface ProviderOptions {
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
