export const joinListValues = (values: unknown[]): string => {
  const tokens: string[] = [];

  values.forEach((value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return;

    const token = String(value).trim();
    if (token && !tokens.includes(token)) tokens.push(token);
  });

  return tokens.join(' ');
};
