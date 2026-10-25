import { getIconSetKey, getIconSubSets, isIconSet } from './icon-sets';

export const createIconSetLoader = (
  request: (path: string) => Promise<Record<string, string>>,
) => {
  const pending = new Map<string, Promise<Record<string, string>>>();

  return (set: string, subSet?: string): Promise<Record<string, string>> => {
    if (!isIconSet(set)) return Promise.reject(new Error('Unknown icon set'));
    const key = getIconSetKey(set, subSet);
    const existing = pending.get(key);
    if (existing) return existing;

    const query = new URLSearchParams({ set });
    if (subSet && getIconSubSets(set).includes(subSet))
      query.set('subSet', subSet);
    const promise = Promise.resolve()
      .then(() => request(`/blockstudio/v1/icons?${query}`))
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
};
