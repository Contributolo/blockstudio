type InitializationField = {
  id?: string;
  type?: string;
  asset?: boolean;
  min?: number;
  default?: unknown;
  attributes?: InitializationField[];
  tabs?: { attributes?: InitializationField[] }[];
};

export const needsFieldInitialization = (
  fields: InitializationField[] = [],
  values: unknown = {},
  extensions = false,
  prefix = '',
): boolean =>
  fields.some((field) => {
    if (field.type === 'group') {
      return needsFieldInitialization(
        field.attributes,
        values,
        extensions,
        field.id ? `${prefix}${field.id}_` : prefix,
      );
    }

    if (field.type === 'tabs') {
      return (
        field.tabs?.some((tab) =>
          needsFieldInitialization(tab.attributes, values, extensions, prefix),
        ) ?? false
      );
    }

    if (field.type === 'code' && (field.asset || extensions)) return true;
    // Custom components can depend on their existing mount effects.
    if (field.type?.includes('/')) return true;
    if (field.type !== 'repeater' || !field.id) return false;

    const value =
      values !== null && typeof values === 'object'
        ? (values as Record<string, unknown>)[`${prefix}${field.id}`]
        : undefined;
    if (
      (value === undefined || value === '') &&
      ((Array.isArray(field.default) && field.default.length > 0) ||
        (Number.isInteger(field.min) && Number(field.min) > 0))
    )
      return true;

    return (
      Array.isArray(value) &&
      value.some(
        (row) =>
          row !== null &&
          typeof row === 'object' &&
          !Array.isArray(row) &&
          needsFieldInitialization(field.attributes, row, extensions),
      )
    );
  });
