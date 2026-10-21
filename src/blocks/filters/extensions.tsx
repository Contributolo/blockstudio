import { InspectorControls } from '@wordpress/block-editor';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect } from '@wordpress/data';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { cloneDeep, isArray, set as lodashSet } from 'lodash-es';
import { Fields } from '@/blocks/components/fields';
import { getEditorDocument } from '@/blocks/utils/get-editor-document';
import { joinListValues } from '@/blocks/utils/join-list-values';
import { needsFieldInitialization } from '@/blocks/utils/needs-field-initialization';
import { parseTemplate } from '@/blocks/utils/parse-template';
import { selectors as selectorsTailwind } from '@/tailwind/store/selectors';
import {
  Any,
  BlockstudioBlock,
  BlockstudioBlockAttributes,
} from '@/types/types';

const extensions = window.blockstudioAdmin.data.extensions;
const isCanvas = !!(window as any).blockstudioCanvas;

type ExtensionSet = { attribute: string; value: string; join?: boolean };

const matchFound = (name: string, string: string) => {
  if (typeof name === 'string' && name.endsWith('*')) {
    const prefix = name.slice(0, -1);
    return string.startsWith(prefix);
  } else {
    return name === string;
  }
};

const getMatchesWithWildcard = (string: string) => {
  return extensions
    .filter((e: { name: string | string[] }) => {
      if (Array.isArray(e.name)) {
        return e.name.some((name) => matchFound(name, string));
      } else {
        return matchFound(e.name, string);
      }
    })
    .sort((a: BlockstudioBlock, b: BlockstudioBlock) => {
      const prioA = (a.blockstudio as Any)?.extend?.priority || 0;
      const prioB = (b.blockstudio as Any)?.extend?.priority || 0;

      if (prioA > prioB) {
        return 1;
      } else if (prioA < prioB) {
        return -1;
      } else {
        return 0;
      }
    });
};

export const shouldExtend = (string: string): boolean => {
  return getMatchesWithWildcard(string).length > 0;
};

export const getMatches = (string: string) => {
  return getMatchesWithWildcard(string);
};

const getAttributes = (
  attributes: BlockstudioBlockAttributes,
  name: string,
  disabled: string[],
) => {
  const classNames: string[] = [];
  const styles: string[] = [];
  const dataAttributes: Record<string, string> = {};

  getMatches(name).forEach((block: BlockstudioBlock) => {
    Object.values(block.attributes || {}).forEach((attribute: Any) => {
      if (disabled.includes(attribute.id)) return;
      if (attribute.set?.length) {
        attribute.set.forEach((set: ExtensionSet) => {
          if ((attributes as Any)?.[attribute.id]) {
            const copy = cloneDeep(attributes) as Any;
            const entries = copy[attribute.id];
            // Opt-in, as in render_blocks(): without join every entry of a
            // list overwrites the attribute and the last one wins.
            const join =
              set.join === true &&
              set.attribute !== 'class' &&
              set.attribute !== 'style' &&
              isArray(entries);
            const list: Any[] = [];

            const applyValue = (value: Any) => {
              if (['select', 'radio', 'checkbox'].includes(attribute.field)) {
                if (
                  attribute.populate &&
                  attribute?.optionsPopulate?.includes(value.value)
                ) {
                  value.value = attribute.optionsPopulateFull[value.value];
                }

                if (
                  !attribute.returnFormat ||
                  attribute.returnFormat === 'value'
                ) {
                  lodashSet(copy, attribute.id, value.value);
                }
                if (attribute.returnFormat === 'label') {
                  lodashSet(copy, attribute.id, value.label);
                }
              }

              // Tokens are stored as { value, label }; render_blocks()
              // receives them reduced to the return format.
              if (
                attribute.field === 'token' &&
                attribute.returnFormat !== 'both'
              ) {
                lodashSet(
                  copy,
                  attribute.id,
                  value?.[attribute.returnFormat || 'value'] ?? value,
                );
              }

              const val = set.value
                ? parseTemplate(set.value, {
                    attributes: copy,
                  })
                : value;

              if (set.attribute === 'class') {
                classNames.push(val);
              } else if (set.attribute === 'style') {
                styles.push(val.replace(/;+$/, ''));
              } else if (join) {
                list.push(val);
              } else {
                dataAttributes[set.attribute] = val;
              }
            };

            if (isArray(entries)) {
              // As in render_blocks(), each entry is the field's value while
              // its template is evaluated.
              entries.forEach((value: Any) => {
                lodashSet(copy, attribute.id, value);
                applyValue(value);
              });

              const joined = joinListValues(list);
              if (join && joined) {
                dataAttributes[set.attribute] = joined;
              }
            } else {
              applyValue(entries);
            }
          }
        });
      }
      if (attribute.field === 'attributes') {
        const copy = cloneDeep(attributes) as Any;
        (copy?.[attribute.id] || [])
          .filter((attr: Any) => attr?.attribute)
          .forEach((attr: Any) => {
            dataAttributes[attr.attribute] = attr.value;
          });
      }
    });
  });

  return {
    classNames: [...new Set(classNames)],
    styles,
    dataAttributes,
  };
};

addFilter(
  'editor.BlockEdit',
  'blockstudio/extensions/set',
  createHigherOrderComponent((BlockEdit) => {
    return (props: Any) => {
      const ref = useRef<HTMLDivElement>(null);

      if (!shouldExtend(props.name)) return <BlockEdit {...props} />;

      const [isLoaded, setIsLoaded] = useState(false);
      const { attributes, setAttributes } = props;

      useEffect(() => {
        const html = ref?.current?.closest('html');
        if (
          html?.classList.contains('block-editor-block-preview__content-iframe')
        ) {
          return;
        }
        const needsInitialization = getMatches(props.name).some(
          (block: BlockstudioBlock) =>
            needsFieldInitialization(
              block.blockstudio?.attributes,
              attributes.blockstudio?.attributes,
              true,
            ),
        );
        if (!needsInitialization) {
          setIsLoaded(true);
          return;
        }
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
      }, []);

      if (isLoaded) {
        return (
          <>
            <BlockEdit {...props} />
            {getMatches(props.name).map(
              (e: BlockstudioBlock, index: number) => {
                return (
                  <>
                    {needsFieldInitialization(
                      e.blockstudio?.attributes,
                      attributes.blockstudio?.attributes,
                      true,
                    ) &&
                      createPortal(
                        <div
                          data-blockstudio-initialization
                          style={{ display: 'none' }}
                        >
                          <Fields
                            {...{ attributes, setAttributes }}
                            clientId={props.clientId}
                            block={e}
                            extensions
                            portal
                          />
                          <style>{`.blockstudio-fields .components-form-toggle__track, .blockstudio-fields .components-form-toggle__thumb { transition: none !important; }`}</style>
                        </div>,
                        document.body,
                      )}
                    <InspectorControls
                      key={index}
                      {...((
                        e.blockstudio as {
                          group: string;
                        }
                      ).group
                        ? {
                            group: (
                              e.blockstudio as {
                                group: string;
                              }
                            ).group,
                          }
                        : {})}
                    >
                      <Fields
                        {...{ attributes, setAttributes }}
                        clientId={props.clientId}
                        block={e}
                        extensions
                      />
                    </InspectorControls>
                  </>
                );
              },
            )}
          </>
        );
      }

      return (
        <div style={{ display: 'contents' }} ref={ref}>
          <BlockEdit {...props} />
        </div>
      );
    };
  }, 'addCustomControlsToEditorBlock'),
);

addFilter(
  'editor.BlockListBlock',
  'blockstudio/extension/edit',
  createHigherOrderComponent((BlockListBlock) => {
    return (props: {
      attributes: {
        blockstudio: {
          attributes: BlockstudioBlockAttributes;
          disabled: string[];
        };
      };
      className: string;
      clientId: string;
      name: string;
    }) => {
      if (!shouldExtend(props.name)) return <BlockListBlock {...props} />;

      const temporaryClasses = useSelect(
        (select) =>
          (
            select('blockstudio/tailwind') as typeof selectorsTailwind
          ).getTemporaryClasses(),
        [],
      );

      const currentTemporaryClasses = Object.entries(temporaryClasses || {})
        .filter(([key, _]) => key.startsWith(props.clientId))
        .map(([_, value]) => value)
        .join(' ')
        .trim();

      const markerRef = useRef<HTMLSpanElement>(null);

      const { styles, classNames, dataAttributes } = getAttributes(
        props.attributes?.blockstudio?.attributes,
        props.name,
        props.attributes?.blockstudio?.disabled || [],
      );

      const updatedClassNames = [props.className || '', ...classNames]
        .filter(Boolean)
        .join(' ')
        .trim();

      useEffect(() => {
        const doc = isCanvas
          ? (markerRef.current?.ownerDocument ?? getEditorDocument())
          : getEditorDocument();
        const id = `blockstudio-${props.clientId}`;

        let element = doc.getElementById(id) as HTMLStyleElement | null;
        if (!element) {
          element = doc.createElement('style');
          element.id = id;
          doc.head.appendChild(element);
        }

        element.textContent = `.editor-styles-wrapper [data-block="${props.clientId}"] {${styles.join(';')}}`;

        return () => {
          element?.remove();
        };
      }, [styles, props.clientId]);

      if (isCanvas) {
        return (
          <>
            <span
              ref={markerRef}
              data-blockstudio-style-marker=""
              style={{ display: 'none' }}
            />
            <BlockListBlock
              {...props}
              wrapperProps={{ ...dataAttributes }}
              className={`${updatedClassNames}${
                currentTemporaryClasses ? ' ' + currentTemporaryClasses : ''
              }`}
            />
          </>
        );
      }

      return (
        <BlockListBlock
          {...props}
          wrapperProps={{ ...dataAttributes }}
          className={`${updatedClassNames}${
            currentTemporaryClasses ? ' ' + currentTemporaryClasses : ''
          }`}
        />
      );
    };
  }, 'addCustomClassNameToEditorBlock'),
);
