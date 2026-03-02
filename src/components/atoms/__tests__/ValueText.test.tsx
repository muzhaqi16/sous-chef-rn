import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ValueText } from '../ValueText';

describe('ValueText', () => {
  it('renders children text', () => {
    render(<ValueText>Some value</ValueText>);
    expect(screen.getByText('Some value')).toBeTruthy();
  });

  it('renders numeric children', () => {
    render(<ValueText>{42}</ValueText>);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ValueText>Test</ValueText>);
    expect(toJSON()).toBeTruthy();
  });

  it('renders empty string', () => {
    const { toJSON } = render(<ValueText>{''}</ValueText>);
    expect(toJSON()).toBeTruthy();
  });
});
