type ExtensionTarget = { name: string | string[]; exclude?: string[] };

const matches = (pattern: unknown, name: string) =>
  typeof pattern === 'string' &&
  pattern.length > 0 &&
  (pattern.endsWith('*')
    ? name.startsWith(pattern.slice(0, -1))
    : pattern === name);

export const extensionTargetsBlock = (
  extension: ExtensionTarget,
  name: string,
) =>
  (Array.isArray(extension.name) ? extension.name : [extension.name]).some(
    (pattern) => matches(pattern, name),
  ) &&
  !(Array.isArray(extension.exclude) ? extension.exclude : []).some((pattern) =>
    matches(pattern, name),
  );
