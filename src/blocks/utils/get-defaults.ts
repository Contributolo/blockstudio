import { cloneDeep } from 'lodash-es';
import type { BlockstudioFieldsOptions } from '@/types/types';

type DefaultValue =
  | string
  | number
  | boolean
  | BlockstudioFieldsOptions[]
  | Record<string, unknown>[];

type BlockstudioDefaults = {
  attributes: BlockstudioDefaults[];
  default: DefaultValue;
  field: string;
  id: string;
  min?: number;
  options: BlockstudioFieldsOptions[];
  type: string;
};

export const getDefaults = (
  block: BlockstudioDefaults[],
  attributes: Record<string, unknown> = {},
) => {
  const defaults: Record<string, DefaultValue> = {};

  if (!block) {
    return defaults;
  }

  const defaultSetter = (item: BlockstudioDefaults) => {
    if (!item.id) {
      return;
    }

    if (item.field === 'repeater') {
      if (Object.prototype.hasOwnProperty.call(attributes, item.id)) {
        defaults[item.id] = attributes[item.id] as DefaultValue;
        return;
      }

      const rows = Array.isArray(item.default)
        ? item.default
        : Number.isInteger(item.min) && Number(item.min) > 0
          ? Array.from({ length: Number(item.min) }, () => ({}))
          : null;

      if (rows) {
        defaults[item.id] = rows.map((row) => ({
          ...cloneDeep(getDefaults(item.attributes)),
          ...cloneDeep(row),
        }));
        return;
      }
    }

    if (attributes?.[item.id]) {
      defaults[item.id] = attributes[item.id] as DefaultValue;

      return;
    }

    defaults[item.id] = '';

    if (item.default === false) {
      defaults[item.id] = false;
    }

    if (
      (item?.default && !item?.options) ||
      (item?.default &&
        item?.options &&
        (item?.type === 'color' || item?.type === 'gradient')) ||
      (item?.options &&
        (item.options
          .map((e: BlockstudioFieldsOptions) => String(e?.value || e))
          .includes(
            String(
              (item.default as unknown as BlockstudioFieldsOptions)?.value,
            ),
          ) ||
          item.options
            .map((e: BlockstudioFieldsOptions) => String(e?.value || e))
            .includes(
              String((item.default as BlockstudioFieldsOptions[])?.[0]?.value),
            ) ||
          item.options
            .map((e: BlockstudioFieldsOptions) => String(e?.value || e))
            .includes(String(item.default))))
    ) {
      if (item.type === 'number' || item.type === 'range') {
        defaults[item.id] = Number(item.default);
      } else {
        defaults[item.id] = item.default;
      }
    }
  };

  const defaultParser = (attributes: BlockstudioDefaults[]) => {
    attributes.forEach((item: BlockstudioDefaults) => {
      if (item.field === 'group') {
        item?.attributes?.forEach((group: BlockstudioDefaults) => {
          defaultSetter(group);
        });
      } else {
        defaultSetter(item);
      }
    });
  };

  defaultParser(block);

  return defaults;
};
