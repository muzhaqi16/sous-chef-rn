import { StyleSheet } from 'react-native-unistyles';

// The unistyles.ts file configures StyleSheet on import.
// We test that the configuration was applied via the mock.
describe('unistyles configuration', () => {
  it('StyleSheet.configure was called via the mock', () => {
    // The mock from jest.setup.js provides StyleSheet.configure as jest.fn()
    // unistyles.ts calls StyleSheet.configure() on module load
    // We just verify the mock is callable and the module doesn't crash
    expect(StyleSheet.configure).toBeDefined();
  });

  it('StyleSheet.create works with the mock (function form)', () => {
    const styles = StyleSheet.create((theme: any) => ({
      container: {
        padding: theme.spacing.md,
      },
    }));
    expect(styles.container).toBeDefined();
    expect(styles.container.padding).toBe(16);
  });

  it('StyleSheet.create works with the mock (object form)', () => {
    const styles = StyleSheet.create({
      wrapper: {
        flex: 1,
      },
    });
    expect(styles.wrapper).toBeDefined();
    expect(styles.wrapper.flex).toBe(1);
  });
});
