export const readRepeaterState = (key: string): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
};

export const writeRepeaterState = (
  key: string,
  id: string,
  minimized: boolean,
  defaultMinimized: boolean,
): void => {
  const entries = readRepeaterState(key).filter((entry) => entry !== id);
  if (minimized !== defaultMinimized) entries.push(id);
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    // The control still works when storage is disabled or full.
  }
};
