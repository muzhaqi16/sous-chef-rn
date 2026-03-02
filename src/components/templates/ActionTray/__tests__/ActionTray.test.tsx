'use no memo';
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ActionTray } from '../ActionTray';

jest.mock('#components/providers/OverlayBackdropProvider', () => ({
  useOverlayBackdrop: jest.fn(() => ({
    showBackdrop: jest.fn(),
    hideBackdrop: jest.fn(),
  })),
}));

jest.mock('../ActionTrayContent', () => ({
  ActionTrayContent: ({ children, title }: any) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(RN.View, { testID: 'action-tray-content' },
      title ? R.createElement(RN.Text, null, title) : null,
      children,
    );
  },
}));

describe('ActionTray', () => {
  it('renders with children', () => {
    render(
      <ActionTray>
        <Text>Tray content</Text>
      </ActionTray>,
    );
    expect(screen.getByText('Tray content')).toBeTruthy();
  });

  it('renders with title', () => {
    render(
      <ActionTray title="Actions">
        <Text>Content</Text>
      </ActionTray>,
    );
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('exposes ref methods', () => {
    const ref = React.createRef<any>();
    render(
      <ActionTray ref={ref}>
        <Text>Content</Text>
      </ActionTray>,
    );
    expect(ref.current).toBeTruthy();
    expect(ref.current.open).toBeDefined();
    expect(ref.current.close).toBeDefined();
    expect(ref.current.toggle).toBeDefined();
    expect(ref.current.isActive).toBeDefined();
  });

  it('isActive returns false initially', () => {
    const ref = React.createRef<any>();
    render(
      <ActionTray ref={ref}>
        <Text>Content</Text>
      </ActionTray>,
    );
    expect(ref.current.isActive()).toBe(false);
  });

  it('renders the ActionTrayContent wrapper', () => {
    render(
      <ActionTray>
        <Text>Content</Text>
      </ActionTray>,
    );
    expect(screen.getByTestId('action-tray-content')).toBeTruthy();
  });
});
