import { CheckboxControl } from '@wordpress/components';
import { Base } from '@/blocks/components/base';
import {
  isSameOptionValue,
  normalizeOptionValues,
} from '@/blocks/utils/option-values';
import { BlockstudioAttribute } from '@/types/block';
import { BlockstudioFieldsOptions } from '@/types/types';
import { __ } from '@/utils/__';

export const Checkbox = ({
  item,
  change,
  v,
  options = [],
}: {
  item: BlockstudioAttribute;
  change: (value: string | BlockstudioFieldsOptions[], force?: boolean) => void;
  v: BlockstudioAttribute;
  options: BlockstudioFieldsOptions[];
}) => {
  const optionValueLabels = options.map(({ value, label }) => ({
    value,
    label,
  }));
  const values = normalizeOptionValues(v, options);

  return (
    <Base>
      <div className={`blockstudio-space blockstudio-space--half`}>
        {item?.toggle && (
          <CheckboxControl
            checked={values.length === options.length}
            className={`components-base-control`}
            label={__(
              typeof item?.toggle === 'string'
                ? item?.toggle
                : 'Toggle all options',
              typeof item?.toggle === 'string',
            )}
            onChange={() =>
              values.length === options.length
                ? change([], true)
                : change(optionValueLabels, true)
            }
          />
        )}
        {options.map((itemInner) => {
          return (
            <CheckboxControl
              key={itemInner.value}
              onChange={() => change(itemInner.value)}
              checked={values.some((e) =>
                isSameOptionValue(e.value, itemInner.value),
              )}
              label={itemInner.label}
              className={`components-base-control`}
            />
          );
        })}
      </div>
    </Base>
  );
};
