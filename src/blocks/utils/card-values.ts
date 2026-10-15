export const normalizeCardValues = <T>(
  value: T | T[] | false | null | undefined,
): T[] => (Array.isArray(value) ? value : value ? [value] : []);

export const isMediaId = (value: unknown): value is string | number =>
  (typeof value === 'string' || typeof value === 'number') &&
  /^[1-9]\d*$/.test(`${value}`);
