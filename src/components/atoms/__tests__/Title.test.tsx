import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Title } from '../Title';

describe('Title', () => {
  it('renders children text', () => {
    render(<Title>My Title</Title>);
    expect(screen.getByText('My Title')).toBeTruthy();
  });

  it('renders different text', () => {
    render(<Title>Settings</Title>);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<Title>Test</Title>);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom style', () => {
    const { toJSON } = render(<Title style={{ color: 'red' }}>Styled</Title>);
    expect(toJSON()).toBeTruthy();
  });
});
