'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { SelectorContent } from '../../../../src/components/organisms/AnimatedItemSelector/SelectorContent';

jest.mock('../../../../src/apollo/links/tokenScheduler');
jest.mock('../../../../src/apollo/links/refreshToken');

jest.mock('../../../../src/components/organisms/AnimatedItemSelector/SelectorItem', () => ({
  SelectorItem: () => null,
}));
jest.mock('../../../../src/components/organisms/AnimatedItemSelector/ActionButtons', () => ({
  ActionButtons: () => null,
}));

describe('SelectorContent', () => {
  const baseConfig = {
    title: 'Select Item',
    data: [],
    onSelect: jest.fn(),
    displayProperty: 'name',
    actions: [],
  };

  it('renders loading state', () => {
    const { getByText } = render(
      <SelectorContent config={{ ...baseConfig, loading: true }} />,
    );
    expect(getByText('Loading...')).toBeTruthy();
  });

  it('renders empty state with default message', () => {
    const { getByText } = render(
      <SelectorContent config={baseConfig} />,
    );
    expect(getByText('No items available')).toBeTruthy();
  });

  it('renders empty state with custom message', () => {
    const { getByText } = render(
      <SelectorContent
        config={{ ...baseConfig, emptyMessage: 'Nothing here' }}
      />,
    );
    expect(getByText('Nothing here')).toBeTruthy();
  });

  it('renders items when data is provided', () => {
    const data = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];
    const { toJSON } = render(
      <SelectorContent config={{ ...baseConfig, data }} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
