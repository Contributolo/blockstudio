import { getRegex } from '@/blocks/components/block/utils/get-regex';

export const getInnerHTML = (htmlString: string) => {
  htmlString = htmlString.replace(
    getRegex('([a-zA-Z][a-zA-Z0-9:-]*)', 'g'),
    (tag, name, attributes) =>
      tag.endsWith('/>') ? `<${name}${attributes}></${name}>` : tag,
  );

  // A template keeps parsed markup inert so inspection does not load resources.
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
