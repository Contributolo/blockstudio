export const getInnerHTML = (htmlString: string) => {
  htmlString = htmlString.replace(/<(\w+)([^>]*)\s?\/>/g, '<$1$2></$1>');

  // A template parses a fragment like the spec's fragment algorithm and keeps
  // its content inert, so nothing loads while the markup is inspected.
  const template = document.createElement('template');
  template.innerHTML = htmlString;

  let element = template.content.firstElementChild?.innerHTML ?? '';

  element = element
    .replaceAll(/<innerblocks([^>]*)>\s*<\/innerblocks>/g, '<InnerBlocks$1 />')
    .replaceAll(/<richtext([^>]*)>\s*<\/richtext>/g, '<RichText$1 />')
    .replaceAll(
      /<mediaplaceholder([^>]*)>\s*<\/mediaplaceholder>/g,
      '<MediaPlaceholder$1 />',
    );

  return element;
};
