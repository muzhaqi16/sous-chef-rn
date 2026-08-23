'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { HomeStats } from '../HomeStats';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

describe('HomeStats', () => {
  it('renders stat numbers', () => {
    render(<HomeStats totalHomes={2} totalMembers={5} totalPantries={3} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows singular labels for count of 1', () => {
    render(<HomeStats totalHomes={1} totalMembers={1} totalPantries={1} />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Member')).toBeTruthy();
    expect(screen.getByText('Pantry')).toBeTruthy();
  });

  it('shows plural labels for count > 1', () => {
    render(<HomeStats totalHomes={2} totalMembers={3} totalPantries={4} />);
    expect(screen.getByText('Homes')).toBeTruthy();
    expect(screen.getByText('Members')).toBeTruthy();
    expect(screen.getByText('Pantries')).toBeTruthy();
  });
});
