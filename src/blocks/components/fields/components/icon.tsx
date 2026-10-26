import apiFetch from '@wordpress/api-fetch';
import { SelectControl, ComboboxControl } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { Base } from '@/blocks/components/base';
import { selectors } from '@/blocks/store/selectors';
import { getIconOptions } from '@/blocks/utils/icon-options';
import { createIconSetLoader } from '@/blocks/utils/icon-loader';
import {
  getDefaultIconSet,
  getDefaultSubSet,
  getIconSetKey,
  getIconSubSets,
  iconData,
  isIconSet,
} from '@/blocks/utils/icon-sets';
import { css } from '@/utils/css';

const loadIconSet = createIconSetLoader((path) =>
  apiFetch<Record<string, string>>({ path, method: 'GET' }),
);

export const Icon = ({
  item,
  change,
  value,
}: {
  item: {
    sets?: string[] | string;
    subSets?: string[] | string;
    label: string;
  };
  change: (item: { set: string; subSet?: string; icon: string }) => void;
  value: {
    set: string;
    subSet?: string;
    icon: string;
  };
}) => {
  const { setIcons } = useDispatch('blockstudio/blocks');
  const icons = useSelect(
    (select) => (select('blockstudio/blocks') as typeof selectors).getIcons(),
    [],
  );

  const [set, setSet] = useState(
    isIconSet(value?.set ?? '') ? value.set : getDefaultIconSet(item?.sets),
  );

  const [subSet, setSubSet] = useState(
    value?.subSet && getIconSubSets(set).includes(value.subSet)
      ? value.subSet
      : getDefaultSubSet(set, item?.subSets),
  );

  const [active, setActive] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const string = getIconSetKey(set, subSet);
  const iconSet = icons?.[string] as unknown as
    | Record<string, string>
    | undefined;

  useEffect(() => {
    if (!active || iconSet) {
      setLoading(false);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    loadIconSet(set, subSet)
      .then((data) => {
        if (!cancelled) setIcons({ [string]: data });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, set, subSet, iconSet, attempt, setIcons]);

  useEffect(() => {
    const nextSet = isIconSet(value?.set ?? '')
      ? value.set
      : getDefaultIconSet(item?.sets);
    setSet(nextSet);
    setSubSet(
      value?.subSet && getIconSubSets(nextSet).includes(value.subSet)
        ? value.subSet
        : getDefaultSubSet(nextSet, item?.subSets),
    );
  }, [value?.set, value?.subSet]);

  return (
    <Base>
      <div
        css={css({
          '& > * + *': {
            marginTop: 'calc(var(--blockstudio-fields-space) / 2)',
          },
        })}
      >
        <SelectControl
          options={Object.keys(iconData)
            .filter((e) =>
              item?.sets?.length
                ? item.sets.includes(e)
                : item?.sets
                  ? e === item.sets
                  : e,
            )
            .map((e) => {
              return {
                value: e,
                label: e,
              };
            })}
          value={set}
          onChange={(value: string) => {
            setActive(true);
            setSet(value);
            setSubSet(getDefaultSubSet(value, item?.subSets));
          }}
        />
        <SelectControl
          options={getIconSubSets(set)
            .filter((e: string | string[]) =>
              item?.subSets?.length
                ? item.subSets.includes(e as string)
                : item?.subSets
                  ? e === item.subSets
                  : e,
            )
            .map((e: string) => {
              return {
                value: e,
                label: e,
              };
            })}
          value={subSet}
          onChange={(value: string) => {
            setActive(true);
            setSubSet(value);
          }}
        />
        <div
          onFocus={() => {
            setActive(true);
            setAttempt((count) => count + 1);
          }}
        >
          <ComboboxControl
            isLoading={loading}
            help={failed ? 'Unable to load icons.' : undefined}
            options={getIconOptions(iconSet, value?.icon)}
            onChange={(icon) =>
              icon &&
              change(
                getIconSubSets(set).includes(subSet)
                  ? { set, subSet, icon }
                  : {
                      set,
                      icon,
                    },
              )
            }
            value={value?.icon || null}
            __experimentalRenderItem={(e) => (
              <span
                css={css({
                  display: 'flex',
                  alignItems: 'center',
                  svg: {
                    height: '16px',
                    width: '16px',
                    marginRight: '12px',
                    fill: 'currentColor',
                  },
                })}
              >
                <span
                  dangerouslySetInnerHTML={{
                    __html: iconSet?.[e.item.value + '.svg'] ?? '',
                  }}
                />
                {e.item.label}
              </span>
            )}
          />
        </div>
      </div>
    </Base>
  );
};
