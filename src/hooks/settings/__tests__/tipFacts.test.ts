import { act } from '@testing-library/react-native';
import { useStore } from '#store';
import { Telemetry } from '#services/telemetry';
import { hasTipFact, noteTipFact } from '../useFeatureHint';

const signIn = (createdAt: string) =>
  act(() => {
    useStore.setState({
      user: {
        id: 'u1',
        email: 'new@example.com',
        emailVerified: true,
        onBoarded: true,
        createdAt,
      },
      tipFacts: {},
    });
  });

const activations = () =>
  jest
    .mocked(Telemetry.trackEvent)
    .mock.calls.filter(([name]) => name === 'activation_reached');

beforeEach(() => jest.mocked(Telemetry.trackEvent).mockClear());

describe('tip facts and activation', () => {
  it('keeps a fact for the signed-in account', () => {
    signIn(new Date().toISOString());

    noteTipFact('recipeSaved');

    expect(hasTipFact('recipeSaved', 'u1')).toBe(true);
    expect(hasTipFact('recipeAdded', 'u1')).toBe(false);
  });

  it('sends activation once: dated food and an opened recipe within three days', () => {
    signIn(new Date(Date.now() - 60 * 60 * 1000).toISOString());

    noteTipFact('datedItem');
    expect(activations()).toHaveLength(0);
    noteTipFact('recipeOpened');
    noteTipFact('recipeOpened');
    noteTipFact('datedItem');

    expect(activations()).toHaveLength(1);
  });

  it('sends no activation for first steps taken after three days', () => {
    signIn(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString());

    noteTipFact('datedItem');
    noteTipFact('recipeOpened');

    expect(activations()).toHaveLength(0);
  });
});
