import type { BlockstudioFieldsOptions } from '@/types/types';

type OptionValue = { value: string | number; label: string };

// Multiple selects and checkboxes store a list of options, but content saved
// before `multiple` was enabled holds one option object, and content written
// outside the editor often holds a plain value.
export const normalizeOptionValues = (
  value: unknown,
  options: BlockstudioFieldsOptions[] = [],
): OptionValue[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    return 'value' in value ? [value as OptionValue] : [];
  }
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    value === ''
  ) {
    return [];
  }

  const option = options.find((e) => String(e?.value) === String(value));

  return [
    { value: option?.value ?? value, label: option?.label || `${value}` },
  ];
};
