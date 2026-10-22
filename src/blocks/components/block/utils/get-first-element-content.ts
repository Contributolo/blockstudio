import { getRegex } from '@/blocks/components/block/utils/get-regex';

export const getInnerHTML = (htmlString: string) => {
  htmlString = htmlString.replace(
    getRegex('([a-zA-Z][a-zA-Z0-9:-]*)', 'g'),
    (tag, name, attributes) =>
      tag.endsWith('/>') ? `<${name}${attributes}></${name}>` : tag,
  );

  // A template parses a fragment like the spec's fragment algorithm and keeps
  // its content inert, so nothing loads while the markup is inspected.
  const template = document.createElement('template');
  template.innerHTML = htmlString;

  let element = template.content.firstElementChild?.innerHTML ?? '';

  for (const [tag, name] of Object.entries({
    innerblocks: 'InnerBlocks',
    richtext: 'RichText',
    mediaplaceholder: 'MediaPlaceholder',
  })) {
    element = element.replace(
      new RegExp(`${getRegex(tag).source}\\s*</${tag}>`, 'g'),
      `<${name}$1 />`,
    );
  }

  return element;
};
