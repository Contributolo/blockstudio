import type { BlockstudioFieldsOptions } from '@/types/types';

type OptionValue = { value: string | number; label: string };

// A native select otherwise displays its first option even though the stored
// value is empty. The placeholder must not become a new selectable choice.
export const getNativeSelectOptions = (
  value: unknown,
  options: BlockstudioFieldsOptions[],
): (BlockstudioFieldsOptions & { disabled?: boolean })[] => {
  const isEmpty =
    value === undefined || value === null || value === false || value === '';

  return isEmpty && !options.some((option) => option.value === '')
    ? [{ value: '', label: '', disabled: true }, ...options]
    : options;
};

const isOptionObject = (value: unknown): value is OptionValue =>
  !!value && typeof value === 'object' && 'value' in value;

// Options are declared as plain values or as `{ value, label }` objects, and
// zero, "0" and "" are valid option values in either form.
export const getOptionValue = (option: unknown) =>
  isOptionObject(option) ? option.value : option;

export const getOptionLabel = (option: unknown): string => {
  const label = isOptionObject(option) ? option.label : option;

  return label === undefined || label === null || label === ''
    ? `${getOptionValue(option) ?? ''}`
    : `${label}`;
};

// Stored values and option values can differ in type, for example "1" saved
// by a script for a numeric option. The server matches them the same way.
export const isSameOptionValue = (a: unknown, b: unknown) =>
  String(a) === String(b);

export const findOption = (options: unknown[] | undefined, value: unknown) =>
  options?.find((option) => isSameOptionValue(getOptionValue(option), value));

const toOptionValue = (value: unknown, options: unknown[]): OptionValue => {
  const option = findOption(options, value) ?? value;

  return {
    value: getOptionValue(option) as string | number,
    label: getOptionLabel(option),
  };
};

const readOptionValue = (value: unknown, options: unknown[]) => {
  if (isOptionObject(value)) {
    return value.value === undefined || value.value === null ? [] : [value];
  }

  return typeof value === 'number' || (typeof value === 'string' && value)
    ? [toOptionValue(value, options)]
    : [];
};

// Multiple selects and checkboxes store a list of options, but content saved
// before `multiple` was enabled holds one option object, and content written
// outside the editor often holds a plain value or a list of plain values.
export const normalizeOptionValues = (
  value: unknown,
  options: unknown[] = [],
): OptionValue[] => {
  if (!Array.isArray(value)) return readOptionValue(value, options);
  if (value.every((e) => readOptionValue(e, options)[0] === e)) return value;

  return value.flatMap((e) => readOptionValue(e, options));
};

// Checkboxes and multiple selects call this with the option that was clicked,
// so 0 and "" toggle like any other value. Clearing every option is a direct
// change with an empty list; undefined and null still clear as before.
export const toggleOptionValue = (
  stored: unknown,
  value: unknown,
  options: unknown[] = [],
): OptionValue[] => {
  if (value === undefined || value === null) return [];

  const selected = normalizeOptionValues(stored, options);

  return selected.some((e) => isSameOptionValue(e.value, value))
    ? selected.filter((e) => !isSameOptionValue(e.value, value))
    : [...selected, toOptionValue(value, options)];
};
