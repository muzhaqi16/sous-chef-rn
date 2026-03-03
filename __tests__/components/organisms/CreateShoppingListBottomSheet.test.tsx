'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { CreateShoppingListBottomSheet } from '../../../src/components/organisms/CreateShoppingListBottomSheet';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        surfaceVariant: '#f5f5f5',
        border: '#ddd',
        error: 'red',
        textTertiary: '#999',
      },
    },
  }),
}));
jest.mock('../../../src/components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: (props: any) => {
    const { Text } = require('react-native');
    return <Text>{props.title}</Text>;
  },
}));
jest.mock('../../../src/graphql/generated', () => ({
  useCreateShoppingListMutation: () => [jest.fn(), { loading: false }],
}));

describe('CreateShoppingListBottomSheet', () => {
  const defaultProps = {
    visible: false,
    onClose: jest.fn(),
  };

  it('renders without crashing', () => {
    const { toJSON } = render(
      <CreateShoppingListBottomSheet {...defaultProps} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('shows the title', () => {
    const { getByText } = render(
      <CreateShoppingListBottomSheet {...defaultProps} />,
    );
    expect(getByText('New Shopping List')).toBeTruthy();
  });

  it('shows list name label', () => {
    const { getByText } = render(
      <CreateShoppingListBottomSheet {...defaultProps} />,
    );
    expect(getByText('List Name *')).toBeTruthy();
  });

  it('renders with onSuccess callback', () => {
    const { toJSON } = render(
      <CreateShoppingListBottomSheet
        {...defaultProps}
        onSuccess={jest.fn()}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
