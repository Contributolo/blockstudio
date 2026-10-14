import {
  useBlockProps,
  RichText as WordPressRichText,
} from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { cloneDeep, get, set } from 'lodash-es';
import styleToObject from 'style-to-object';
import {
  Any,
  BlockstudioBlock,
  BlockstudioBlockAttributes,
} from '@/types/types';

export const RichText = ({
  attributes,
  setAttributes,
  block,
  clientId,
  data,
  hasOwnBlockProps,
}: {
  attributes: BlockstudioBlockAttributes;
  setAttributes: (attributes: BlockstudioBlockAttributes) => void;
  block: BlockstudioBlock;
  clientId: string;
  data: { attribute: string; tag?: string; [key: string]: Any };
  hasOwnBlockProps: boolean;
}) => {
  const currentAttributes = useSelect(
    (select: Any) =>
      select('core/block-editor').getBlockAttributes(clientId) as
        | BlockstudioBlockAttributes
        | undefined,
    [clientId],
  );

  const { tag, ...rest } = data;
  const blockProps = hasOwnBlockProps
    ? useBlockProps()
    : ({} as {
        className: string;
      });
  const richTextBlockProps = {
    ...blockProps,
    tagName: (tag || 'p') as keyof HTMLElementTagNameMap,
    className:
      (rest?.class || '') +
      (hasOwnBlockProps ? ` ${blockProps.className}` : ''),
    style: styleToObject(rest?.style || '') || undefined,
  };

  if (rest.class) delete rest.class;
  if (rest.style) delete rest.style;

  const props = { ...richTextBlockProps, ...rest };

  const blockAttrs = block.attributes as Record<string, Any>;
  const attrKey = data.attribute;
  const hasAttr = attrKey.includes('[')
    ? !!blockAttrs[attrKey.split('[')[0]]
    : !!blockAttrs[attrKey];

  if (!hasAttr) return null;

  const setter = (value: string) => {
    const source = currentAttributes ?? attributes;
    const values = cloneDeep(source.blockstudio?.attributes ?? {});
    set(values, data.attribute, value);
    setAttributes({
      blockstudio: {
        ...source.blockstudio,
        attributes: values,
      },
    } as BlockstudioBlockAttributes);
  };

  return (
    <WordPressRichText
      {...props}
      value={
        get(
          (currentAttributes ?? attributes).blockstudio?.attributes,
          data.attribute,
        ) || ''
      }
      onChange={(value: string) => setter(value)}
    />
  );
};
