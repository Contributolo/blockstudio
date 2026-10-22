import { get } from 'lodash-es';

export const resolvePopulate = (
  value: unknown,
  attributes: Record<string, unknown>,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => resolvePopulate(entry, attributes));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        resolvePopulate(entry, attributes),
      ]),
    );
  }
  if (typeof value !== 'string') return value;

  const exact = value.match(/^\{attributes\.([^{}]+)\}$/);
  if (exact) return get(attributes, exact[1], value);

  return value.replace(/\{attributes\.([^{}]+)\}/g, (match, path) =>
    String(get(attributes, path, match)),
  );
};

export const getPopulateRequest = (
  populate: Record<string, unknown>,
  search: string,
): Record<string, unknown> => {
  if (populate.type !== 'query') return populate;

  return {
    ...populate,
    arguments: {
      ...((populate.arguments as object) || {}),
      search:
        populate.query === 'users' && search !== '' ? `*${search}*` : search,
      s: search,
    },
  };
};
