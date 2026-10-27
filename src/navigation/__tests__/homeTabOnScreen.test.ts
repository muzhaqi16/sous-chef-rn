import { homeTabOnScreen } from '../homeTabOnScreen';

const mockRef = {
  isReady: jest.fn(() => true),
  getRootState: jest.fn<unknown, []>(),
};
jest.mock('#services/NavigationService', () => ({
  get navigationRef() {
    return mockRef;
  },
}));

const tabs = (index: number) => ({
  index,
  routes: [{ name: 'Today' }, { name: 'Pantry' }, { name: 'ShoppingList' }],
});

describe('homeTabOnScreen', () => {
  beforeEach(() => {
    mockRef.isReady.mockReturnValue(true);
  });

  it('names the tab the user sees', () => {
    mockRef.getRootState.mockReturnValue({
      index: 0,
      routes: [{ name: 'Home', state: tabs(1) }],
    });

    expect(homeTabOnScreen()).toBe('Pantry');
  });

  it('shows no tab under a screen pushed over the tabs', () => {
    mockRef.getRootState.mockReturnValue({
      index: 1,
      routes: [{ name: 'Home', state: tabs(1) }, { name: 'RecipeDetail' }],
    });

    expect(homeTabOnScreen()).toBeNull();
  });

  // Unknown counts every query as shown, so a resync still re-asks it.
  it('cannot say before the tabs have a state', () => {
    mockRef.getRootState.mockReturnValue({
      index: 0,
      routes: [{ name: 'Home' }],
    });

    expect(homeTabOnScreen()).toBeUndefined();
  });

  it('cannot say before navigation is ready', () => {
    mockRef.isReady.mockReturnValue(false);

    expect(homeTabOnScreen()).toBeUndefined();
  });
});
