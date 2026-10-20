import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RecipeInstructions } from '../RecipeInstructions';

describe('RecipeInstructions', () => {
  it.each([
    {
      shape: 'plain text, as a seeded recipe stores it',
      instructions: ['Season the chicken', 'Heat the oil'],
    },
    {
      shape: '{ step, text }',
      instructions: [
        { step: 1, text: 'Season the chicken' },
        { step: 2, text: 'Heat the oil' },
      ],
    },
    {
      shape: '{ number, step }, from an older import',
      instructions: [
        { number: 1, step: 'Season the chicken' },
        { number: 2, step: 'Heat the oil' },
      ],
    },
  ])('shows each step of $shape with its number', ({ instructions }) => {
    render(<RecipeInstructions instructions={instructions} />);

    expect(screen.getByText('Season the chicken')).toBeTruthy();
    expect(screen.getByText('Heat the oil')).toBeTruthy();
    expect(screen.getByText('2.')).toBeTruthy();
  });

  it('renders nothing for a recipe with no steps', () => {
    render(<RecipeInstructions instructions={[]} />);

    expect(screen.toJSON()).toBeNull();
  });
});
