import { PAGE_SIZE } from '#features/pantry/constants/pagination';

describe('pagination constants', () => {
  it('exports PAGE_SIZE with expected keys', () => {
    expect(PAGE_SIZE.COMPACT).toBe(15);
    expect(PAGE_SIZE.DEFAULT).toBe(20);
    expect(PAGE_SIZE.SCROLL).toBe(30);
    expect(PAGE_SIZE.EXTENDED).toBe(50);
    expect(PAGE_SIZE.MAX).toBe(100);
  });
});
