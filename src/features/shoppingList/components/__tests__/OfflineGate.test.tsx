'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OfflineGate } from '#features/shoppingList/components/OfflineGate';
import { Text } from '#components/atoms/Text';
import { useStore } from '#store';

jest.mock('#components/atoms/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text: RNText } = require('react-native');
    return <RNText>{name}</RNText>;
  },
}));

describe('OfflineGate', () => {
  beforeEach(() => {
    useStore.setState({ isOnline: true, apiReachable: true });
  });

  it('renders children when online', () => {
    render(
      <OfflineGate>
        <Text role="body">Online Content</Text>
      </OfflineGate>,
    );
    expect(screen.getByText('Online Content')).toBeTruthy();
  });

  it.each([
    ['no connection', { isOnline: false, apiReachable: null }],
    ['the API down on working Wi-Fi', { isOnline: true, apiReachable: false }],
  ])('shows offline message with %s in replace mode', (_cause, network) => {
    useStore.setState(network);
    render(
      <OfflineGate message="Custom offline message">
        <Text role="body">Online Content</Text>
      </OfflineGate>,
    );
    expect(screen.getByText('Custom offline message')).toBeTruthy();
    expect(screen.queryByText('Online Content')).toBeNull();
  });

  it('renders nothing when offline in hide mode', () => {
    useStore.setState({ isOnline: false, apiReachable: null });
    const { toJSON } = render(
      <OfflineGate mode="hide">
        <Text role="body">Online Content</Text>
      </OfflineGate>,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders compact layout when compact prop is true', () => {
    useStore.setState({ isOnline: false, apiReachable: null });
    render(
      <OfflineGate compact message="Search unavailable">
        <Text role="body">Online Content</Text>
      </OfflineGate>,
    );
    expect(screen.getByText('Search unavailable')).toBeTruthy();
  });
});
