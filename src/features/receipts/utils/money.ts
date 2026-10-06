/** Money is compared and summed in whole cents, where floats add up exactly. */
export const toCents = (value: number) => Math.round(value * 100);
