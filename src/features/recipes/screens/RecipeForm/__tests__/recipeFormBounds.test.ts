import { recipeFormSchema, recipeFormDefaults } from '../recipeFormConfig';

const base = () => ({
  ...recipeFormDefaults(),
  name: 'Soup',
  ingredients: [
    {
      id: 'i1',
      name: 'Water',
      quantity: 1,
      isOptional: false,
      sortOrder: 0,
    },
  ],
  steps: [{ id: 's1', instruction: 'Boil water', sortOrder: 0 }],
});

async function firstError(state: unknown): Promise<string | null> {
  try {
    await recipeFormSchema.validate(state, { abortEarly: true });
    return null;
  } catch (e) {
    return (e as { message: string }).message;
  }
}

describe('the recipe form bounds', () => {
  it('accepts a valid recipe', async () => {
    expect(await firstError(base())).toBeNull();
  });

  describe('imageUrl', () => {
    it.each([
      'https://example.com/a.png',
      'http://example.com/a.png',
      ' https://example.com/a.png ',
      '',
    ])('accepts %p', async imageUrl => {
      expect(await firstError({ ...base(), imageUrl })).toBeNull();
    });

    // The API's URL scalar refuses these before any resolver runs.
    // Assembled, not written literally: `no-script-url` flags the literal even
    // in a test asserting that the schema refuses it.
    const scriptUrl = `${'java'}${'script'}:alert(1)`;
    it.each([
      'ftp://example.com/a.png',
      scriptUrl,
      'example.com',
      'https://',
      'https://exa mple.com/a.png',
      `https://example.com/${'a'.repeat(2048)}`,
    ])('refuses %p on the field', async imageUrl => {
      expect(await firstError({ ...base(), imageUrl })).toContain('http');
    });
  });

  describe('the instructions JSON bound', () => {
    it('refuses more than 1,000 steps', async () => {
      const steps = Array.from({ length: 1001 }, (_, i) => ({
        id: `s${i}`,
        instruction: 'x',
        sortOrder: i,
      }));
      expect(await firstError({ ...base(), steps })).toContain('1000');
    });

    it('accepts exactly 1,000', async () => {
      const steps = Array.from({ length: 1000 }, (_, i) => ({
        id: `s${i}`,
        instruction: 'x',
        sortOrder: i,
      }));
      expect(await firstError({ ...base(), steps })).toBeNull();
    });

    it('refuses steps over 64 KiB serialized', async () => {
      const steps = [
        { id: 's1', instruction: 'x'.repeat(70 * 1024), sortOrder: 0 },
      ];
      expect(await firstError({ ...base(), steps })).toBeTruthy();
    });

    it('measures UTF-8 bytes, not UTF-16 code units', async () => {
      // Every character here is 3 bytes, so 30k of them is ~90 KiB — over the
      // bound — while `String.length` would read 30k and let it through, which
      // is exactly the accented and non-Latin recipes the server refuses.
      const steps = [
        { id: 's1', instruction: '日'.repeat(30_000), sortOrder: 0 },
      ];
      expect(await firstError({ ...base(), steps })).toBeTruthy();
    });
  });

  // The API's recipe bounds: at most 10 tags of 1–50 characters after
  // trimming, tips at most 2,000 characters.
  describe('tags', () => {
    const tagList = (count: number, length = 5) =>
      Array.from({ length: count }, (_, i) => `${i}`.padEnd(length, 'x')).join(
        ', ',
      );

    it('accepts 10 tags of 50 characters', async () => {
      expect(await firstError({ ...base(), tags: tagList(10, 50) })).toBeNull();
    });

    it('refuses an 11th tag', async () => {
      expect(await firstError({ ...base(), tags: tagList(11) })).toContain(
        '10',
      );
    });

    it('refuses a tag over 50 characters', async () => {
      expect(await firstError({ ...base(), tags: tagList(1, 51) })).toContain(
        '50',
      );
    });

    it('counts neither blank entries nor surrounding spaces', async () => {
      const tags = ` ${'x'.repeat(50)} ,, ${tagList(9)}, `;
      expect(await firstError({ ...base(), tags })).toBeNull();
    });
  });

  describe('tips', () => {
    it('accepts 2,000 characters', async () => {
      expect(
        await firstError({ ...base(), tips: 'x'.repeat(2000) }),
      ).toBeNull();
    });

    it('refuses 2,001', async () => {
      expect(await firstError({ ...base(), tips: 'x'.repeat(2001) })).toContain(
        '2000',
      );
    });
  });
});
