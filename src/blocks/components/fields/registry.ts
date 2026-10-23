import type { ComponentType } from 'react';
import type { BlockstudioAttribute } from '@/types/block';
import type {
  BlockstudioBlock,
  BlockstudioBlockAttributes,
} from '@/types/types';

export type BlockstudioCustomFieldProps = BlockstudioAttribute & {
  type: string;
  id: string;
  field: BlockstudioAttribute;
  value: unknown;
  defaultValue: unknown;
  onChange: (value: unknown) => void;
  attributes: BlockstudioBlockAttributes;
  block: BlockstudioBlock;
  clientId: string;
  inRepeater: boolean;
  repeaterId: string;
  disabled: boolean;
};

type CustomFieldTypeRegistration = {
  component: ComponentType<BlockstudioCustomFieldProps>;
};

const fieldTypes = new Map<string, CustomFieldTypeRegistration>();

export const isCustomFieldTypeName = (name: string) =>
  /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/.test(name) &&
  !name.startsWith('custom/') &&
  !name.startsWith('blockstudio/');

export const sanitizeFieldTypeClassName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Register or replace the React editor control for a custom field type.
 * The matching field metadata must be registered separately in PHP.
 *
 * @param name Lowercase namespace/type-name. The custom/ and blockstudio/
 * namespaces are reserved.
 * @param registration Registration containing the React component.
 * @returns True if accepted, false for an invalid name or missing component.
 * @example
 * window.blockstudio.registerFieldType('acme/dimensions', {
 *   component: DimensionsControl,
 * });
 */
export const registerFieldType = (
  name: string,
  registration: CustomFieldTypeRegistration,
) => {
  if (!isCustomFieldTypeName(name) || !registration?.component) {
    return false;
  }

  fieldTypes.set(name, registration);

  return true;
};

/**
 * Remove a custom field's client-side control registration.
 *
 * @param name Namespaced field type to unregister.
 * @returns True if a registration was removed, false if none existed.
 * @example
 * window.blockstudio.unregisterFieldType('acme/dimensions');
 */
export const unregisterFieldType = (name: string) => fieldTypes.delete(name);

export const getFieldType = (name: string) => fieldTypes.get(name);

if (typeof window !== 'undefined') {
  window.blockstudio = window.blockstudio || {};
  window.blockstudio.registerFieldType = registerFieldType;
  window.blockstudio.unregisterFieldType = unregisterFieldType;
}
